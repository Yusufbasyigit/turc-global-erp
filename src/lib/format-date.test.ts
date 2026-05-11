import { formatDateOnly, istanbulToday, parseDateLocal } from "./format-date";

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

section("8. istanbulToday: 21:00 UTC Apr 30 -> 2026-05-01 in Istanbul (+03:00)");
{
  // 2026-04-30T21:00:00Z. UTC slice would give "2026-04-30", but Istanbul
  // is already 00:00 on May 1. The helper must return tomorrow's date.
  const d = new Date(Date.UTC(2026, 3, 30, 21, 0, 0));
  assertEq("rolls forward at IST midnight", istanbulToday(d), "2026-05-01");
}

section("9. istanbulToday: 22:30 UTC Apr 30 -> 2026-05-01 (well after IST midnight)");
{
  const d = new Date(Date.UTC(2026, 3, 30, 22, 30, 0));
  assertEq("after midnight IST", istanbulToday(d), "2026-05-01");
}

section("10. istanbulToday: 20:59 UTC Apr 30 -> 2026-04-30 (one minute before IST midnight)");
{
  // 23:59 Istanbul time. UTC slice and istanbulToday agree here.
  const d = new Date(Date.UTC(2026, 3, 30, 20, 59, 0));
  assertEq("before midnight IST", istanbulToday(d), "2026-04-30");
}

section("11. istanbulToday: 02:00 UTC Jan 1 -> 2026-01-01 (5:00 IST, well into the day)");
{
  // At 02:00 UTC, UTC slice gives Jan 1 and IST is also Jan 1. Sanity check
  // that the helper doesn't accidentally subtract the offset.
  const d = new Date(Date.UTC(2026, 0, 1, 2, 0, 0));
  assertEq("morning IST same day", istanbulToday(d), "2026-01-01");
}

section("12. istanbulToday: format is exactly YYYY-MM-DD (en-CA contract)");
{
  const d = new Date(Date.UTC(2026, 0, 5, 12, 0, 0));
  const out = istanbulToday(d);
  assertEq("ten-char string", out.length, 10);
  assertEq("dashes at 4 and 7", `${out[4]}${out[7]}`, "--");
  assertEq("parsable", /^\d{4}-\d{2}-\d{2}$/.test(out), true);
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
