import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  FxSnapshotInsert,
  PriceSnapshotInsert,
  TickerRegistryInsert,
} from "@/lib/supabase/types";

import {
  COINPAPRIKA_API,
  COINPAPRIKA_IDS,
  COINPAPRIKA_SOURCE,
  FX_API_BASE,
  FX_SOURCE,
  GOLD_API_BASE,
  GOLD_API_SOURCE,
  METAL_ASSET_MAP,
  OZ_TO_GRAM,
} from "./constants";

export type RefreshOutcome = {
  inserted: number;
  skipped: string[];
  errors: string[];
};

export type TriggeredBy = "cron" | "manual";

// Accept an untyped client: the browser passes one via `createClient()`
// (no Database generic), and the Deno edge function passes a service-role
// client. Inserts stay type-safe via the imported *Insert types.
type Client = SupabaseClient;

// External rate APIs occasionally hang; cap each request so a single slow
// upstream can't pin a refresh run forever. 15s is comfortably above any
// healthy response we've seen and well below the edge function ceiling.
const REFRESH_FETCH_TIMEOUT_MS = 15_000;

function fetchWithTimeout(url: string): Promise<Response> {
  return fetch(url, { signal: AbortSignal.timeout(REFRESH_FETCH_TIMEOUT_MS) });
}

type FrankfurterLatest = {
  base: string;
  date: string;
  rates: Record<string, number>;
};

type CoinpaprikaTicker = {
  id: string;
  quotes?: { USD?: { price: number } };
};

type CoinpaprikaCoin = {
  id: string;
  name: string;
  symbol: string;
  rank?: number;
  is_active?: boolean;
  type?: string;
};

type GoldApiResponse = {
  symbol: string;
  price: number;
};

// Intentionally NO `.is("deleted_at", null)` filter: the refresh engine must
// keep populating fx_snapshots for any currency the company ever held,
// even after the corresponding account is soft-deleted. Historical ledger
// queries (and any future restored account) depend on continuous price
// data, and the upstream API call is the same regardless of how many
// accounts hold the code.
async function listFiatCodes(client: Client): Promise<string[]> {
  const { data, error } = await client
    .from("accounts")
    .select("asset_code, asset_type")
    .eq("asset_type", "fiat");
  if (error) throw error;
  const codes = new Set<string>();
  for (const row of data ?? []) {
    const code = row.asset_code?.trim().toUpperCase();
    if (code) codes.add(code);
  }
  return Array.from(codes);
}

// Same rationale as listFiatCodes above: include soft-deleted accounts so
// price snapshots stay continuous even when an account is retired.
async function listNonFiatAssets(
  client: Client,
): Promise<{ asset_code: string; asset_type: string }[]> {
  const { data, error } = await client
    .from("accounts")
    .select("asset_code, asset_type")
    .in("asset_type", ["crypto", "metal"]);
  if (error) throw error;
  const seen = new Set<string>();
  const out: { asset_code: string; asset_type: string }[] = [];
  for (const row of data ?? []) {
    const code = row.asset_code?.trim();
    const type = row.asset_type;
    if (!code || !type) continue;
    const k = `${type}:${code}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ asset_code: code, asset_type: type });
  }
  return out;
}

// Pull CoinPaprika's full coin catalogue and upsert it into ticker_registry.
// Run as part of the daily refresh job; lets the account form's crypto
// dropdown enumerate every priceable ticker without a hardcoded list, and
// lets refreshPriceSnapshots resolve any asset_code to a provider slug.
//
// CoinPaprika returns ~3000 coins; many share a symbol (e.g. multiple "BTC"
// forks/scams), so we keep only the best-ranked active entry per symbol.
export async function refreshTickerRegistry(
  client: Client,
): Promise<RefreshOutcome> {
  const errors: string[] = [];
  let inserted = 0;

  try {
    const res = await fetchWithTimeout(`${COINPAPRIKA_API}/coins`);
    if (!res.ok) {
      errors.push(`coinpaprika /coins: ${res.status} ${res.statusText}`);
      return { inserted: 0, skipped: [], errors };
    }
    const all = (await res.json()) as CoinpaprikaCoin[];

    const bestBySymbol = new Map<string, CoinpaprikaCoin>();
    for (const c of all) {
      if (c.is_active === false) continue;
      if (!c.symbol || !c.id || !c.name) continue;
      const symbol = c.symbol.trim().toUpperCase();
      if (!symbol) continue;
      const existing = bestBySymbol.get(symbol);
      const incomingRank = c.rank && c.rank > 0 ? c.rank : Number.MAX_SAFE_INTEGER;
      const existingRank =
        existing?.rank && existing.rank > 0 ? existing.rank : Number.MAX_SAFE_INTEGER;
      if (!existing || incomingRank < existingRank) {
        bestBySymbol.set(symbol, c);
      }
    }

    const rows: TickerRegistryInsert[] = [];
    const now = new Date().toISOString();
    for (const [symbol, c] of bestBySymbol) {
      rows.push({
        provider: "coinpaprika",
        code: symbol,
        slug: c.id,
        name: c.name,
        rank: c.rank && c.rank > 0 ? c.rank : null,
        last_seen_at: now,
      });
    }

    // Upsert in chunks to keep individual statements small.
    const CHUNK = 500;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const slice = rows.slice(i, i + CHUNK);
      const { data, error } = await client
        .from("ticker_registry")
        .upsert(slice, { onConflict: "provider,code" })
        .select("code");
      if (error) {
        errors.push(`upsert chunk ${i / CHUNK}: ${error.message}`);
        continue;
      }
      inserted += (data ?? []).length;
    }
  } catch (e) {
    errors.push(`coinpaprika /coins: ${(e as Error).message}`);
  }

  return { inserted, skipped: [], errors };
}

// Pull every coinpaprika row from ticker_registry into a code → slug map.
// Used by refreshPriceSnapshots so that any asset_code matching a known
// ticker resolves to a slug without needing the hardcoded COINPAPRIKA_IDS.
async function loadCoinpaprikaSlugMap(
  client: Client,
): Promise<Map<string, string>> {
  const { data, error } = await client
    .from("ticker_registry")
    .select("code, slug")
    .eq("provider", "coinpaprika");
  if (error) throw error;
  const map = new Map<string, string>();
  for (const row of (data ?? []) as { code: string; slug: string }[]) {
    map.set(row.code.toUpperCase(), row.slug);
  }
  return map;
}

export async function refreshFxSnapshots(
  client: Client,
): Promise<RefreshOutcome> {
  const codes = await listFiatCodes(client);
  const fetchedAt = new Date().toISOString();
  const snapshotDate = fetchedAt.slice(0, 10);

  const rows: FxSnapshotInsert[] = [];
  const errors: string[] = [];

  for (const code of codes) {
    if (code === "USD") {
      rows.push({
        currency_code: "USD",
        rate_to_usd: 1,
        snapshot_date: snapshotDate,
        fetched_at: fetchedAt,
        source: FX_SOURCE,
      });
      continue;
    }
    try {
      const res = await fetchWithTimeout(
        `${FX_API_BASE}/latest?from=${encodeURIComponent(code)}&to=USD`,
      );
      if (!res.ok) {
        errors.push(`${code}: ${res.status} ${res.statusText}`);
        continue;
      }
      const json = (await res.json()) as FrankfurterLatest;
      const rate = json?.rates?.USD;
      if (!Number.isFinite(rate) || rate <= 0) {
        errors.push(`${code}: missing USD rate`);
        continue;
      }
      rows.push({
        currency_code: code,
        rate_to_usd: rate,
        snapshot_date: snapshotDate,
        fetched_at: fetchedAt,
        source: FX_SOURCE,
      });
    } catch (e) {
      errors.push(`${code}: ${(e as Error).message}`);
    }
  }

  if (rows.length === 0) {
    return { inserted: 0, skipped: [], errors };
  }

  const { data, error } = await client
    .from("fx_snapshots")
    .upsert(rows, { onConflict: "currency_code,snapshot_date,source" })
    .select();
  if (error) throw error;
  return { inserted: (data ?? []).length, skipped: [], errors };
}

export async function refreshPriceSnapshots(
  client: Client,
): Promise<RefreshOutcome> {
  const assets = await listNonFiatAssets(client);
  const fetchedAt = new Date().toISOString();
  const snapshotDate = fetchedAt.slice(0, 10);

  const rows: PriceSnapshotInsert[] = [];
  const skipped: string[] = [];
  const errors: string[] = [];

  const cryptoCodes = assets
    .filter((a) => a.asset_type === "crypto")
    .map((a) => a.asset_code);
  const metalCodes = assets
    .filter((a) => a.asset_type === "metal")
    .map((a) => a.asset_code);

  // Registry first, fall back to the hardcoded map. The registry is the
  // source of truth once the daily seeder has run; the map covers the
  // first run on a fresh DB and acts as a safety net if /coins is down.
  const registrySlugs = cryptoCodes.length
    ? await loadCoinpaprikaSlugMap(client).catch(() => new Map<string, string>())
    : new Map<string, string>();

  for (const code of cryptoCodes) {
    const upper = code.toUpperCase();
    const id = registrySlugs.get(upper) ?? COINPAPRIKA_IDS[upper];
    if (!id) {
      skipped.push(code);
      continue;
    }
    try {
      const res = await fetchWithTimeout(`${COINPAPRIKA_API}/tickers/${id}`);
      if (!res.ok) {
        errors.push(`${code}: ${res.status} ${res.statusText}`);
        continue;
      }
      const json = (await res.json()) as CoinpaprikaTicker;
      const price = json?.quotes?.USD?.price;
      if (price == null || !Number.isFinite(price) || price <= 0) {
        errors.push(`${code}: missing USD price`);
        continue;
      }
      rows.push({
        asset_code: code,
        price,
        price_currency: "USD",
        snapshot_date: snapshotDate,
        source: COINPAPRIKA_SOURCE,
      });
    } catch (e) {
      errors.push(`${code}: ${(e as Error).message}`);
    }
  }

  const needs = {
    gold: metalCodes.some((c) => METAL_ASSET_MAP[c]?.metal === "gold"),
    silver: metalCodes.some((c) => METAL_ASSET_MAP[c]?.metal === "silver"),
  };
  const usdPerOz: Partial<Record<"gold" | "silver", number>> = {};

  if (needs.gold) {
    try {
      const res = await fetchWithTimeout(`${GOLD_API_BASE}/XAU`);
      if (res.ok) {
        const json = (await res.json()) as GoldApiResponse;
        if (Number.isFinite(json?.price) && json.price > 0) {
          usdPerOz.gold = json.price;
        } else {
          errors.push(`XAU: missing price`);
        }
      } else {
        errors.push(`XAU: ${res.status} ${res.statusText}`);
      }
    } catch (e) {
      errors.push(`XAU: ${(e as Error).message}`);
    }
  }
  if (needs.silver) {
    try {
      const res = await fetchWithTimeout(`${GOLD_API_BASE}/XAG`);
      if (res.ok) {
        const json = (await res.json()) as GoldApiResponse;
        if (Number.isFinite(json?.price) && json.price > 0) {
          usdPerOz.silver = json.price;
        } else {
          errors.push(`XAG: missing price`);
        }
      } else {
        errors.push(`XAG: ${res.status} ${res.statusText}`);
      }
    } catch (e) {
      errors.push(`XAG: ${(e as Error).message}`);
    }
  }

  for (const code of metalCodes) {
    const info = METAL_ASSET_MAP[code];
    if (!info) {
      skipped.push(code);
      continue;
    }
    const perOz = usdPerOz[info.metal];
    if (perOz == null) continue;
    const price = info.unit === "gram" ? perOz / OZ_TO_GRAM : perOz;
    rows.push({
      asset_code: code,
      price,
      price_currency: "USD",
      snapshot_date: snapshotDate,
      source: GOLD_API_SOURCE,
    });
  }

  if (rows.length === 0) {
    return { inserted: 0, skipped, errors };
  }

  const { data, error } = await client
    .from("price_snapshots")
    .upsert(rows, { onConflict: "asset_code,snapshot_date,source" })
    .select();
  if (error) throw error;
  return { inserted: (data ?? []).length, skipped, errors };
}

export async function logRefreshRun(
  client: Client,
  triggeredBy: TriggeredBy,
  fx: PromiseSettledResult<RefreshOutcome>,
  price: PromiseSettledResult<RefreshOutcome>,
): Promise<void> {
  const fxOutcome =
    fx.status === "fulfilled"
      ? fx.value
      : { inserted: 0, skipped: [], errors: [String(fx.reason?.message ?? fx.reason ?? "unknown")] };
  const priceOutcome =
    price.status === "fulfilled"
      ? price.value
      : { inserted: 0, skipped: [], errors: [String(price.reason?.message ?? price.reason ?? "unknown")] };
  const errorMessage = [
    fx.status === "rejected" ? `fx: ${String(fx.reason?.message ?? fx.reason)}` : null,
    price.status === "rejected" ? `price: ${String(price.reason?.message ?? price.reason)}` : null,
  ]
    .filter(Boolean)
    .join("; ") || null;

  await client.from("rate_refresh_runs").insert({
    triggered_by: triggeredBy,
    fx_outcome: fxOutcome,
    price_outcome: priceOutcome,
    error_message: errorMessage,
  });
}
