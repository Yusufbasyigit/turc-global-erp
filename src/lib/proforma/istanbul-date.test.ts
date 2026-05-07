import {
  istanbulYYYYMMDD,
  formatOfferDateShort,
  todayIsoDate,
  addDaysIso,
  istanbulYearMonth,
  shiftYearMonth,
} from "./istanbul-date";

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

section("1. istanbulYYYYMMDD: midday UTC anchor lands on the same Istanbul date");
{
  // 2026-04-25T12:00Z is 15:00 in Istanbul → still 25th there.
  assertEq(
    "midday",
    istanbulYYYYMMDD(new Date("2026-04-25T12:00:00Z")),
    "20260425",
  );
}

section("2. istanbulYYYYMMDD: late UTC = next day in Istanbul (UTC+3)");
{
  // 2026-04-25T22:00Z is 01:00 on 26 in Istanbul.
  assertEq(
    "late UTC -> next day",
    istanbulYYYYMMDD(new Date("2026-04-25T22:00:00Z")),
    "20260426",
  );
}

section("3. istanbulYYYYMMDD: zero-pads single-digit month/day");
{
  assertEq(
    "Jan 5",
    istanbulYYYYMMDD(new Date("2026-01-05T12:00:00Z")),
    "20260105",
  );
}

section("4. formatOfferDateShort: ISO date → DD.MM.YYYY");
{
  assertEq("typical", formatOfferDateShort("2026-04-25"), "25.04.2026");
  assertEq("with timestamp", formatOfferDateShort("2026-04-25T12:00:00Z"), "25.04.2026");
}

section("5. formatOfferDateShort: null/undefined/empty → em dash");
{
  assertEq("null", formatOfferDateShort(null), "—");
  assertEq("undefined", formatOfferDateShort(undefined), "—");
  assertEq("empty", formatOfferDateShort(""), "—");
}

section("6. formatOfferDateShort: malformed input falls back to em dash");
{
  // Anything that doesn't yield three '-'-separated parts is treated as
  // missing rather than echoed back verbatim, so the UI never renders a
  // half-formatted date string.
  assertEq("garbage", formatOfferDateShort("no"), "—");
  assertEq("partial ISO", formatOfferDateShort("2026-04"), "—");
}

section("7. todayIsoDate: returns en-CA YYYY-MM-DD shape");
{
  const out = todayIsoDate();
  assertEq("YYYY-MM-DD", /^\d{4}-\d{2}-\d{2}$/.test(out), true);
}

section("8. addDaysIso: positive delta crosses month boundary");
{
  assertEq("Apr 28 + 5 -> May 03", addDaysIso("2026-04-28", 5), "2026-05-03");
}

section("9. addDaysIso: negative delta wraps backward across month");
{
  assertEq("Mar 03 - 5 -> Feb 26", addDaysIso("2026-03-03", -5), "2026-02-26");
}

section("10. addDaysIso: zero delta returns same date");
{
  assertEq("noop", addDaysIso("2026-04-15", 0), "2026-04-15");
}

section("11. addDaysIso: leap-day 2024-02-28 + 1 = 2024-02-29");
{
  assertEq("leap", addDaysIso("2024-02-28", 1), "2024-02-29");
}

section("12. istanbulYearMonth: Date input -> 'YYYY-MM'");
{
  assertEq("April", istanbulYearMonth(new Date("2026-04-15T12:00:00Z")), "2026-04");
}

section("13. istanbulYearMonth: ISO string input -> 'YYYY-MM'");
{
  assertEq("string", istanbulYearMonth("2026-12-25"), "2026-12");
}

section("14. shiftYearMonth: positive delta within year");
{
  assertEq("Apr +2 = Jun", shiftYearMonth("2026-04", 2), "2026-06");
}

section("15. shiftYearMonth: positive delta crosses year");
{
  assertEq("Nov +3 = next Feb", shiftYearMonth("2026-11", 3), "2027-02");
}

section("16. shiftYearMonth: negative delta crosses year backwards");
{
  assertEq("Feb -3 = prev Nov", shiftYearMonth("2026-02", -3), "2025-11");
}

section("17. shiftYearMonth: zero delta returns same period");
{
  assertEq("noop", shiftYearMonth("2026-04", 0), "2026-04");
}

section("18. shiftYearMonth: 12-month shifts move exactly one year");
{
  assertEq("+12", shiftYearMonth("2026-04", 12), "2027-04");
  assertEq("-12", shiftYearMonth("2026-04", -12), "2025-04");
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
