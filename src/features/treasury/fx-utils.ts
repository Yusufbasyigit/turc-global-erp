import type {
  AccountWithCustody,
  FxSnapshot,
  PriceSnapshot,
  RateRefreshRun,
} from "@/lib/supabase/types";
import { FX_STALE_MS } from "./constants";

export function latestFxFetchedAt(fxMap: Map<string, FxSnapshot>): Date | null {
  let latest: Date | null = null;
  for (const snap of fxMap.values()) {
    const d = new Date(snap.fetched_at);
    if (!latest || d > latest) latest = d;
  }
  return latest;
}

export function isFxStale(
  fxMap: Map<string, FxSnapshot>,
  nowMs: number = Date.now(),
): boolean {
  const latest = latestFxFetchedAt(fxMap);
  if (!latest) return true;
  return nowMs - latest.getTime() > FX_STALE_MS;
}

export function usdValueFor(
  account: AccountWithCustody,
  quantity: number,
  fxMap: Map<string, FxSnapshot>,
  priceMap: Map<string, PriceSnapshot>,
): number | null {
  if (!Number.isFinite(quantity)) return null;
  const assetCode = account.asset_code;
  if (!assetCode) return null;

  if (account.asset_type === "fiat") {
    const fx = fxMap.get(assetCode.toUpperCase());
    if (!fx) return null;
    return quantity * Number(fx.rate_to_usd);
  }

  const price = priceMap.get(assetCode);
  if (!price) return null;
  const priceCurrency = price.price_currency?.toUpperCase();
  if (!priceCurrency) return null;
  const fx = fxMap.get(priceCurrency);
  if (!fx) return null;
  return quantity * Number(price.price) * Number(fx.rate_to_usd);
}

export function unitPriceFor(
  account: AccountWithCustody,
  priceMap: Map<string, PriceSnapshot>,
): { price: number; currency: string } | null {
  if (!account.asset_code) return null;
  if (account.asset_type === "fiat") {
    return { price: 1, currency: account.asset_code };
  }
  const p = priceMap.get(account.asset_code);
  if (!p) return null;
  return { price: Number(p.price), currency: p.price_currency };
}

export function formatDateShort(d: Date | string | null): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

let usdFormatter: Intl.NumberFormat | null = null;
export function formatUsd(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  if (!usdFormatter) {
    usdFormatter = new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  return usdFormatter.format(value);
}

const quantityFormatters = new Map<number, Intl.NumberFormat>();
export function formatQuantity(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  const decimals = abs >= 1 ? 2 : 6;
  let fmt = quantityFormatters.get(decimals);
  if (!fmt) {
    fmt = new Intl.NumberFormat(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: decimals,
    });
    quantityFormatters.set(decimals, fmt);
  }
  return fmt.format(value);
}

export function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

// Cron fires Mon-Fri at 06:00 UTC. On Monday morning the most recent cron
// row is Friday's — which is >48h old but not delayed. Compute the most
// recent expected fire (latest Mon-Fri 06:00 UTC + 15min grace before now)
// and compare against that, not against a rolling 36h window.
const CRON_HOUR_UTC = 6;
const GRACE_MIN = 15;

export function mostRecentExpectedRefresh(now: Date = new Date()): Date {
  const d = new Date(now);
  d.setUTCMinutes(0, 0, 0);
  d.setUTCHours(CRON_HOUR_UTC);
  // Rewind until the fire time has elapsed (accounting for grace) AND the
  // day is Mon-Fri.
  const graceMs = GRACE_MIN * 60 * 1000;
  while (
    d.getTime() + graceMs > now.getTime() ||
    d.getUTCDay() === 0 ||
    d.getUTCDay() === 6
  ) {
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return d;
}

export function isRefreshDelayed(
  lastRun: Pick<RateRefreshRun, "ran_at"> | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!lastRun) return true;
  const expected = mostRecentExpectedRefresh(now);
  return new Date(lastRun.ran_at) < expected;
}

export function formatRelativeTime(
  iso: string | null | undefined,
  now: Date = new Date(),
): string {
  if (!iso) return "never";
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return "—";
  const diffMs = now.getTime() - then.getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 36) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}
