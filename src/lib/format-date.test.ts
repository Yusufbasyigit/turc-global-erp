import { formatDateOnly, parseDateLocal } from "./format-date";

let passed = 0;
let failed = 0;

function assertEq<T>(label: string, actual: T, expected: T): void {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
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

section("1. parseDateLocal: YYYY-MM-DD parses to local-tz date (no UTC drift)");
{
  const d = parseDateLocal("2026-04-30");
  if (!d) throw new Error("expected non-null Date");
  assertEq("year", d.getFullYear(), 2026);
  assertEq("month (0-indexed)", d.getMonth(), 3);
  assertEq("day", d.getDate(), 30);
  // Hours should be 0 (local midnight), confirming it's NOT new Date(iso)
  // which would land on UTC midnight = local previous day in west TZs.
  assertEq("hour=0", d.getHours(), 0);
}

section("2. parseDateLocal: extra timestamp falls through to Date(value)");
{
  const d = parseDateLocal("2026-04-30T12:00:00Z");
  if (!d) throw new Error("expected non-null Date");
  assertEq("isFinite", Number.isFinite(d.getTime()), true);
}

section("3. parseDateLocal: garbage returns null");
{
  assertEq("non-date string", parseDateLocal("not-a-date"), null);
  assertEq("empty string", parseDateLocal(""), null);
}

section("4. parseDateLocal: month/day boundary values");
{
  const d1 = parseDateLocal("2026-12-31");
  if (!d1) throw new Error("expected non-null Date");
  assertEq("dec 31 month", d1.getMonth(), 11);

  // 2026-02-30 is invalid Gregorian; native Date rolls it forward to Mar 02.
  // Note: this function does NOT reject impossible calendar dates.
  const d2 = parseDateLocal("2026-02-30");
  if (!d2) throw new Error("expected non-null Date");
  assertEq("feb 30 rolls to march", d2.getMonth(), 2);
  assertEq("feb 30 day", d2.getDate(), 2);
}

section("5. formatDateOnly: null/undefined/empty -> em dash");
{
  assertEq("null", formatDateOnly(null), "—");
  assertEq("undefined", formatDateOnly(undefined), "—");
  assertEq("empty", formatDateOnly(""), "—");
}

section("6. formatDateOnly: malformed input returned as-is");
{
  assertEq("garbage passed through", formatDateOnly("not-a-date"), "not-a-date");
}

section("7. formatDateOnly: returns a non-empty string for a valid ISO date");
{
  const out = formatDateOnly("2026-04-30");
  // Don't assert exact format — Intl can vary by host locale, but it should
  // be a non-empty string that mentions the year.
  assertEq("non-empty", out.length > 0, true);
  assertEq("contains 2026", out.includes("2026"), true);
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
