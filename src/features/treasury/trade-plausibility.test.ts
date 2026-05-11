import type { FxSnapshot, PriceSnapshot } from "@/lib/supabase/types";
import {
  checkTradePlausibility,
  formatTradePlausibilityError,
} from "./trade-plausibility";
import { TRADE_RATE_DIVERGENCE_THRESHOLD } from "./constants";

let passed = 0;
let failed = 0;

function assertEq<T>(label: string, actual: T, expected: T): void {
  const ok =
    typeof actual === "number" && typeof expected === "number"
      ? Math.abs(actual - expected) < 1e-6
      : JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    passed += 1;
    console.log(`  ✓ ${label}`);
  } else {
    failed += 1;
    console.log(
      `  ✗ ${label}\n    expected: ${JSON.stringify(expected)}\n    actual:   ${JSON.stringify(actual)}`,
    );
  }
}

function section(title: string): void {
  console.log(`\n${title}`);
}

function fx(currency: string, rate: number, fetched = "2026-05-11T08:00:00Z"): FxSnapshot {
  return {
    id: `${currency}-${fetched}`,
    currency_code: currency,
    rate_to_usd: rate,
    snapshot_date: fetched.slice(0, 10),
    fetched_at: fetched,
    source: "test",
  } as FxSnapshot;
}

function price(
  code: string,
  value: number,
  currency = "USD",
  date = "2026-05-11",
): PriceSnapshot {
  return {
    id: `${code}-${date}`,
    asset_code: code,
    price: value,
    price_currency: currency,
    snapshot_date: date,
    source: "test",
    created_at: `${date}T08:00:00Z`,
  } as PriceSnapshot;
}

function fxMap(rows: FxSnapshot[]): Map<string, FxSnapshot> {
  const m = new Map<string, FxSnapshot>();
  for (const r of rows) m.set(r.currency_code.toUpperCase(), r);
  return m;
}
function priceMap(rows: PriceSnapshot[]): Map<string, PriceSnapshot> {
  const m = new Map<string, PriceSnapshot>();
  for (const r of rows) m.set(r.asset_code, r);
  return m;
}

section("1. Matching-currency typo: 100 USD -> 1 USD (asset-typed crypto) is blocked");
{
  // Operator meant 1000 -> 1 (1 BTC = 1000 USD-equivalent at this fake rate)
  // but typed 100. Expected ratio (qTo per qFrom) ≈ 0.001 BTC per USD; the
  // typo gives 0.01 — a 10x divergence, well above 25%.
  const r = checkTradePlausibility({
    from: { asset_code: "USD", asset_type: "fiat" },
    to: { asset_code: "BTC", asset_type: "crypto" },
    quantityFrom: 100,
    quantityTo: 1,
    fxMap: fxMap([fx("USD", 1)]),
    priceMap: priceMap([price("BTC", 1000, "USD")]),
  });
  assertEq("status blocked", r.status, "blocked");
  if (r.status === "blocked") {
    assertEq("implied 0.01", r.impliedRate, 0.01);
    assertEq("expected 0.001", r.expectedRate, 0.001);
    assertEq("divergence > threshold", r.divergence > TRADE_RATE_DIVERGENCE_THRESHOLD, true);
  }
}

section("2. Legitimate USD↔EUR trade within spread is allowed");
{
  // 1 USD = 0.92 EUR at market. Operator trades 1000 USD -> 905 EUR (small
  // dealer-margin spread; well within 25%).
  const r = checkTradePlausibility({
    from: { asset_code: "USD", asset_type: "fiat" },
    to: { asset_code: "EUR", asset_type: "fiat" },
    quantityFrom: 1000,
    quantityTo: 905,
    fxMap: fxMap([fx("USD", 1), fx("EUR", 1 / 0.92)]),
    priceMap: priceMap([]),
  });
  assertEq("status ok", r.status, "ok");
  if (r.status === "ok") {
    assertEq("implied ~0.905", Math.abs(r.impliedRate - 0.905) < 1e-9, true);
    assertEq("expected ~0.92", Math.abs(r.expectedRate - 0.92) < 1e-9, true);
    assertEq("divergence under threshold", r.divergence < TRADE_RATE_DIVERGENCE_THRESHOLD, true);
  }
}

section("3. Missing snapshot → no_snapshot, falls through (no block)");
{
  // KTJ has no price snapshot yet (cold start). The trade must not be blocked
  // just because we can't price-check it.
  const r = checkTradePlausibility({
    from: { asset_code: "USD", asset_type: "fiat" },
    to: { asset_code: "KTJ", asset_type: "fund" },
    quantityFrom: 1000,
    quantityTo: 250,
    fxMap: fxMap([fx("USD", 1)]),
    priceMap: priceMap([]),
  });
  assertEq("status no_snapshot", r.status, "no_snapshot");
  if (r.status === "no_snapshot") {
    assertEq("implied still computed", r.impliedRate, 0.25);
    assertEq("expectedRate null", r.expectedRate, null);
    assertEq("divergence null", r.divergence, null);
  }
}

section("4. Crypto trade: BTC → ETH at market is allowed");
{
  // Both legs priced in USD. BTC=$70k, ETH=$3500 → 1 BTC = 20 ETH at market.
  // Operator trades 0.5 BTC → 10 ETH. Implied = 20, expected = 20.
  const r = checkTradePlausibility({
    from: { asset_code: "BTC", asset_type: "crypto" },
    to: { asset_code: "ETH", asset_type: "crypto" },
    quantityFrom: 0.5,
    quantityTo: 10,
    fxMap: fxMap([fx("USD", 1)]),
    priceMap: priceMap([
      price("BTC", 70000, "USD"),
      price("ETH", 3500, "USD"),
    ]),
  });
  assertEq("status ok", r.status, "ok");
  if (r.status === "ok") {
    assertEq("implied 20", r.impliedRate, 20);
    assertEq("expected 20", r.expectedRate, 20);
    assertEq("divergence 0", r.divergence, 0);
  }
}

section("5. Crypto typo: BTC → ETH off by 10x is blocked");
{
  // Operator meant 10 ETH but typed 100 — implied 200 vs expected 20.
  const r = checkTradePlausibility({
    from: { asset_code: "BTC", asset_type: "crypto" },
    to: { asset_code: "ETH", asset_type: "crypto" },
    quantityFrom: 0.5,
    quantityTo: 100,
    fxMap: fxMap([fx("USD", 1)]),
    priceMap: priceMap([
      price("BTC", 70000, "USD"),
      price("ETH", 3500, "USD"),
    ]),
  });
  assertEq("status blocked", r.status, "blocked");
  if (r.status === "blocked") {
    assertEq("error mentions market rate", /market rate/i.test(
      formatTradePlausibilityError({
        from: { asset_code: "BTC", asset_type: "crypto" },
        to: { asset_code: "ETH", asset_type: "crypto" },
        impliedRate: r.impliedRate,
        expectedRate: r.expectedRate,
        divergence: r.divergence,
      }),
    ), true);
  }
}

section("6. Boundary: divergence exactly at threshold is allowed");
{
  // Implied 0.75, expected 1.0 → divergence = 0.25 (== threshold).
  const r = checkTradePlausibility({
    from: { asset_code: "USD", asset_type: "fiat" },
    to: { asset_code: "EUR", asset_type: "fiat" },
    quantityFrom: 100,
    quantityTo: 75,
    fxMap: fxMap([fx("USD", 1), fx("EUR", 1)]),
    priceMap: priceMap([]),
  });
  assertEq("status ok at boundary", r.status, "ok");
}

section("7. Zero/invalid quantities → no_snapshot");
{
  const r = checkTradePlausibility({
    from: { asset_code: "USD", asset_type: "fiat" },
    to: { asset_code: "EUR", asset_type: "fiat" },
    quantityFrom: 0,
    quantityTo: 100,
    fxMap: fxMap([fx("USD", 1), fx("EUR", 1)]),
    priceMap: priceMap([]),
  });
  assertEq("status no_snapshot for zero qty", r.status, "no_snapshot");
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
