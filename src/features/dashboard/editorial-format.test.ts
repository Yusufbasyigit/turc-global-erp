import {
  formatTryShort,
  formatTryFull,
  formatTryCompact,
  formatShortDate,
  formatFooterTimestamp,
  monthLongFromPeriod,
  periodFirstLetter,
  fyQuarterLabel,
  periodRangeLabel,
} from "./editorial-format";

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

section("1. formatTryShort: positive integer-rounded with ₺ prefix");
{
  assertEq("simple", formatTryShort(1234), "₺1,234");
  assertEq("zero", formatTryShort(0), "₺0");
  assertEq("rounds up", formatTryShort(1234.6), "₺1,235");
  assertEq("rounds down", formatTryShort(1234.4), "₺1,234");
}

section("2. formatTryShort: negative uses U+2212 minus, not hyphen");
{
  // Editorial spec uses "−" (U+2212), not "-" (U+002D).
  const out = formatTryShort(-50);
  assertEq("starts with U+2212 minus", out.charCodeAt(0), 0x2212);
  assertEq("absolute value formatted", out, "−₺50");
}

section("3. formatTryFull: 2 decimal places preserved");
{
  assertEq("2dp", formatTryFull(1234.5), "₺1,234.50");
  assertEq("integer", formatTryFull(1234), "₺1,234.00");
  assertEq("zero", formatTryFull(0), "₺0.00");
  assertEq("negative", formatTryFull(-7.5), "−₺7.50");
}

section("4. formatTryCompact: under 1000 -> integer");
{
  assertEq("small int", formatTryCompact(500), "₺500");
  assertEq("rounds in compact", formatTryCompact(999.4), "₺999");
}

section("5. formatTryCompact: thousands -> K with no decimals");
{
  assertEq("K rounds", formatTryCompact(1234), "₺1K");
  assertEq("K large", formatTryCompact(412_000), "₺412K");
  assertEq("K negative", formatTryCompact(-15_000), "−₺15K");
}

section("6. formatTryCompact: millions -> M with 2 decimals");
{
  assertEq("M two dp", formatTryCompact(2_940_000), "₺2.94M");
  assertEq("M exact", formatTryCompact(1_000_000), "₺1.00M");
  assertEq("M negative", formatTryCompact(-2_500_000), "−₺2.50M");
}

section("7. formatShortDate: ISO YYYY-MM-DD -> '24 Apr' style");
{
  // Output depends on en-GB Intl, but should be predictable.
  const out = formatShortDate("2026-04-24");
  // Format is "24 Apr" or similar: contains a 2-digit day and a 3-letter month.
  assertEq("has 24", out.includes("24"), true);
  assertEq("has Apr", out.includes("Apr"), true);
}

section("8. formatShortDate: malformed input returned as-is");
{
  assertEq("bad string", formatShortDate("not-a-date"), "not-a-date");
  // empty falls into `slice(0,10)` → "" → split → all NaN → return iso ("")
  assertEq("empty", formatShortDate(""), "");
}

section("9. formatShortDate: handles ISO with timestamp");
{
  const out = formatShortDate("2026-04-24T15:30:00Z");
  assertEq("has 24", out.includes("24"), true);
  assertEq("has Apr", out.includes("Apr"), true);
}

section("10. formatFooterTimestamp: '25.04.2026 · 09:14' shape");
{
  const d = new Date(2026, 3, 25, 9, 14, 0); // local time
  const out = formatFooterTimestamp(d);
  assertEq("expected", out, "25.04.2026 · 09:14");
}

section("11. formatFooterTimestamp: zero-pads single-digit fields");
{
  const d = new Date(2026, 0, 5, 1, 7, 0);
  assertEq("padded", formatFooterTimestamp(d), "05.01.2026 · 01:07");
}

section("12. monthLongFromPeriod: 'YYYY-MM' -> long month name");
{
  assertEq("Jan", monthLongFromPeriod("2026-01"), "January");
  assertEq("Apr", monthLongFromPeriod("2026-04"), "April");
  assertEq("Dec", monthLongFromPeriod("2026-12"), "December");
}

section("13. monthLongFromPeriod: out-of-range month falls back to input");
{
  // Number("13") - 1 = 12, which is out of bounds → undefined → period itself.
  assertEq("13 fallback", monthLongFromPeriod("2026-13"), "2026-13");
  assertEq("00 fallback", monthLongFromPeriod("2026-00"), "2026-00");
}

section("14. periodFirstLetter: returns single capital letter");
{
  assertEq("Jan -> J", periodFirstLetter("2026-01"), "J");
  assertEq("Feb -> F", periodFirstLetter("2026-02"), "F");
  assertEq("May -> M", periodFirstLetter("2026-05"), "M");
  assertEq("Sep -> S", periodFirstLetter("2026-09"), "S");
}

section("15. periodFirstLetter: out-of-range month -> empty string");
{
  assertEq("13 empty", periodFirstLetter("2026-13"), "");
}

section("16. fyQuarterLabel: months 0-2 -> Q1, etc");
{
  assertEq("Jan", fyQuarterLabel(new Date(2026, 0, 15)), "FY 2026 · Q1");
  assertEq("Apr", fyQuarterLabel(new Date(2026, 3, 15)), "FY 2026 · Q2");
  assertEq("Aug", fyQuarterLabel(new Date(2026, 7, 15)), "FY 2026 · Q3");
  assertEq("Dec", fyQuarterLabel(new Date(2026, 11, 15)), "FY 2026 · Q4");
}

section("17. periodRangeLabel: month-name + day-of-month padded");
{
  const d = new Date(2026, 3, 25); // April 25
  const out = periodRangeLabel(d);
  // "Period: Apr 01 — Apr 25"
  assertEq("starts with Period:", out.startsWith("Period: "), true);
  assertEq("contains 01", out.includes("01"), true);
  assertEq("contains 25", out.includes("25"), true);
  assertEq("contains Apr", out.includes("Apr"), true);
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
