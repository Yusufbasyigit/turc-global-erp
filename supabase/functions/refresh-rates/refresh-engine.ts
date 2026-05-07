// Deno-compatible duplicate of `src/features/treasury/refresh-engine.ts`.
// The constants from `src/features/treasury/constants.ts` are inlined here
// because Supabase Edge Functions bundle only their own folder. Source of
// truth lives in `src/features/treasury/`; if you edit the fetch/upsert
// logic there, edit this copy too.
//
// Flagged in the PR description as a deliberate duplication.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.104.0";

export type RefreshOutcome = {
  inserted: number;
  skipped: string[];
  errors: string[];
};

export type TriggeredBy = "cron" | "manual";

type Client = SupabaseClient;

const FX_API_BASE = "https://api.frankfurter.dev/v1";
const FX_SOURCE = "frankfurter.dev";

const COINPAPRIKA_API = "https://api.coinpaprika.com/v1";
const COINPAPRIKA_SOURCE = "coinpaprika.com";

const GOLD_API_BASE = "https://api.gold-api.com/price";
const GOLD_API_SOURCE = "gold-api.com";

const OZ_TO_GRAM = 31.1034768;

const COINPAPRIKA_IDS: Record<string, string> = {
  BTC: "btc-bitcoin",
  ETH: "eth-ethereum",
  USDT: "usdt-tether",
  USDC: "usdc-usd-coin",
  AVAX: "avax-avalanche",
  BNB: "bnb-binance-coin",
  SOL: "sol-solana",
  XRP: "xrp-xrp",
  ADA: "ada-cardano",
  DOGE: "doge-dogecoin",
  MATIC: "matic-polygon",
  DOT: "dot-polkadot",
  TRX: "trx-tron",
  LINK: "link-chainlink",
  LTC: "ltc-litecoin",
  BCH: "bch-bitcoin-cash",
  ATOM: "atom-cosmos",
  SHIB: "shib-shiba-inu",
  XLM: "xlm-stellar",
  NEAR: "near-near-protocol",
};

const METAL_ASSET_MAP: Record<
  string,
  { metal: "gold" | "silver"; unit: "oz" | "gram" }
> = {
  XAU: { metal: "gold", unit: "oz" },
  XAG: { metal: "silver", unit: "oz" },
  GOLD: { metal: "gold", unit: "oz" },
  SILVER: { metal: "silver", unit: "oz" },
  "Altın": { metal: "gold", unit: "gram" },
  "Altın(gr)": { metal: "gold", unit: "gram" },
  "Gümüş": { metal: "silver", unit: "gram" },
  "Gümüş(gr)": { metal: "silver", unit: "gram" },
};

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

async function listFiatCodes(client: Client): Promise<string[]> {
  const { data, error } = await client
    .from("accounts")
    .select("asset_code, asset_type")
    .eq("asset_type", "fiat");
  if (error) throw error;
  const codes = new Set<string>();
  for (const row of (data ?? []) as { asset_code: string | null }[]) {
    const code = row.asset_code?.trim().toUpperCase();
    if (code) codes.add(code);
  }
  return Array.from(codes);
}

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
  for (const row of (data ?? []) as {
    asset_code: string | null;
    asset_type: string | null;
  }[]) {
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
// Source of truth lives in src/features/treasury/refresh-engine.ts; keep
// these two copies in sync (the Edge Function bundles only its own folder).
export async function refreshTickerRegistry(
  client: Client,
): Promise<RefreshOutcome> {
  const errors: string[] = [];
  let inserted = 0;

  try {
    const res = await fetch(`${COINPAPRIKA_API}/coins`);
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

    type Row = {
      provider: string;
      code: string;
      slug: string;
      name: string;
      rank: number | null;
      last_seen_at: string;
    };
    const rows: Row[] = [];
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

  const rows: Array<{
    currency_code: string;
    rate_to_usd: number;
    snapshot_date: string;
    fetched_at: string;
    source: string;
  }> = [];
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
      const res = await fetch(
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

  const rows: Array<{
    asset_code: string;
    price: number;
    price_currency: string;
    snapshot_date: string;
    source: string;
  }> = [];
  const skipped: string[] = [];
  const errors: string[] = [];

  const cryptoCodes = assets
    .filter((a) => a.asset_type === "crypto")
    .map((a) => a.asset_code);
  const metalCodes = assets
    .filter((a) => a.asset_type === "metal")
    .map((a) => a.asset_code);

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
      const res = await fetch(`${COINPAPRIKA_API}/tickers/${id}`);
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
      const res = await fetch(`${GOLD_API_BASE}/XAU`);
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
      const res = await fetch(`${GOLD_API_BASE}/XAG`);
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
      : {
          inserted: 0,
          skipped: [],
          errors: [String((fx.reason as Error)?.message ?? fx.reason ?? "unknown")],
        };
  const priceOutcome =
    price.status === "fulfilled"
      ? price.value
      : {
          inserted: 0,
          skipped: [],
          errors: [String((price.reason as Error)?.message ?? price.reason ?? "unknown")],
        };
  const errorMessage =
    [
      fx.status === "rejected"
        ? `fx: ${String((fx.reason as Error)?.message ?? fx.reason)}`
        : null,
      price.status === "rejected"
        ? `price: ${String((price.reason as Error)?.message ?? price.reason)}`
        : null,
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
