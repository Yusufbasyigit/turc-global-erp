import { resolveMonthlyRate } from "./queries";
import type { FxSnapshot, MonthlyFxOverride } from "@/lib/supabase/types";

let passed = 0;
let failed = 0;

function approx(a: number, b: number, eps = 0.0001): boolean {
  return Math.abs(a - b) < eps;
}

function assertEq<T>(label: string, actual: T, expected: T): void {
  const ok =
    typeof actual === "number" && typeof expected === "number"
      ? approx(actual, expected)
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

function ovr(
  period: string,
  currency_code: string,
  rate_to_usd: number,
  set_at: string = "2026-01-01T00:00:00Z",
): MonthlyFxOverride {
  return {
    id: `o-${period}-${currency_code}`,
    period,
    currency_code,
    rate_to_usd,
    set_at,
    set_by: null,
    note: null,
  } as unknown as MonthlyFxOverride;
}

function snap(
  currency_code: string,
  snapshot_date: string,
  rate_to_usd: number,
): FxSnapshot {
  return {
    id: `s-${currency_code}-${snapshot_date}`,
    currency_code,
    snapshot_date,
    rate_to_usd,
    fetched_at: `${snapshot_date}T00:00:00Z`,
    source: "frankfurter",
  } as unknown as FxSnapshot;
}

section("1. Override wins over any snapshot");
{
  const r = resolveMonthlyRate(
    "2026-04",
    "EUR",
    [ovr("2026-04", "EUR", 0.9)],
    [snap("EUR", "2026-04-15", 0.95)],
  );
  assertEq("source", r.source, "override");
  assertEq("value", r.value, 0.9);
  assertEq("not stale", r.stale, false);
}

section("2. No override -> latest in-month snapshot wins");
{
  const r = resolveMonthlyRate(
    "2026-04",
    "EUR",
    [],
    [
      snap("EUR", "2026-04-01", 0.92),
      snap("EUR", "2026-04-15", 0.95), // newest in month
      snap("EUR", "2026-04-10", 0.93),
    ],
  );
  assertEq("source", r.source, "snapshot");
  assertEq("uses newest in-month", r.value, 0.95);
  assertEq("asOf", r.asOf, "2026-04-15");
  assertEq("not stale", r.stale, false);
}

section("3. No in-month -> latest snapshot at or before period (stale)");
{
  const r = resolveMonthlyRate(
    "2026-04",
    "EUR",
    [],
    [
      snap("EUR", "2026-02-15", 0.91),
      snap("EUR", "2026-03-20", 0.93), // most recent <= period
      snap("EUR", "2026-05-10", 0.95), // future, ignored
    ],
  );
  assertEq("source", r.source, "snapshot");
  assertEq("uses most-recent prior", r.value, 0.93);
  assertEq("stale", r.stale, true);
  assertEq("asOf", r.asOf, "2026-03-20");
}

section("4. No snapshot at all -> source 'missing', value null");
{
  const r = resolveMonthlyRate("2026-04", "EUR", [], []);
  assertEq("source", r.source, "missing");
  assertEq("value", r.value, null);
  assertEq("displayPerUsd", r.displayPerUsd, null);
  assertEq("not stale", r.stale, false);
}

section("5. Currency code is case-insensitive");
{
  const r = resolveMonthlyRate(
    "2026-04",
    "eur",
    [ovr("2026-04", "EUR", 0.9)],
    [],
  );
  assertEq("matches uppercase", r.source, "override");
  assertEq("value", r.value, 0.9);
}

section("6. displayPerUsd is 1 / rate when rate > 0");
{
  const r = resolveMonthlyRate(
    "2026-04",
    "EUR",
    [ovr("2026-04", "EUR", 0.5)],
    [],
  );
  assertEq("1/0.5 = 2", r.displayPerUsd, 2);
}

section("7. displayPerUsd is null when rate is 0 (no division by zero)");
{
  const r = resolveMonthlyRate(
    "2026-04",
    "EUR",
    [ovr("2026-04", "EUR", 0)],
    [],
  );
  assertEq("null", r.displayPerUsd, null);
}

section("8. Other-currency snapshots ignored");
{
  const r = resolveMonthlyRate(
    "2026-04",
    "EUR",
    [],
    [snap("USD", "2026-04-15", 1)],
  );
  assertEq("missing", r.source, "missing");
}

section("9. Future-only snapshots not used as fallback");
{
  // Period is 2026-04, only have 2026-05 snapshot -> stale fallback should
  // *not* find it since 2026-05 > 2026-04.
  const r = resolveMonthlyRate(
    "2026-04",
    "EUR",
    [],
    [snap("EUR", "2026-05-10", 0.95)],
  );
  assertEq("missing", r.source, "missing");
}

section("10. Override with mismatched period not picked up");
{
  const r = resolveMonthlyRate(
    "2026-04",
    "EUR",
    [ovr("2026-03", "EUR", 0.85)],
    [snap("EUR", "2026-04-10", 0.95)],
  );
  // Should use snapshot, not the override (different period).
  assertEq("source", r.source, "snapshot");
  assertEq("value", r.value, 0.95);
}

section("11. Multiple overrides: matching one is selected");
{
  const r = resolveMonthlyRate(
    "2026-04",
    "EUR",
    [
      ovr("2026-03", "EUR", 0.85),
      ovr("2026-04", "EUR", 0.9), // match
      ovr("2026-04", "USD", 1.0), // wrong currency
    ],
    [],
  );
  assertEq("source", r.source, "override");
  assertEq("value", r.value, 0.9);
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
