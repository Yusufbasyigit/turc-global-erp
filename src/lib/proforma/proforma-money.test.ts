import { formatProformaMoney, formatProformaQty } from "./proforma-money";

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

section("1. formatProformaMoney: basic EUR formatting (fr-FR)");
{
  const s = formatProformaMoney(1234.5, "EUR");
  // fr-FR puts the symbol after, with a regular space (after normalize).
  assertEq("non-empty", s.length > 0, true);
  assertEq("contains amount digits", s.includes("1") && s.includes("234"), true);
  // Currency symbol or code present (€ for EUR in fr-FR).
  assertEq("contains €", s.includes("€"), true);
}

section("2. formatProformaMoney: NNBSP and NBSP are normalized to a regular space");
{
  const s = formatProformaMoney(1234.5, "EUR");
  // The dangerous characters are U+00A0 and U+202F. After normalizeSpaces
  // they should be absent.
  assertEq("no NNBSP", s.includes(" "), false);
  assertEq("no NBSP", s.includes(" "), false);
}

section("3. formatProformaMoney: USD codes in fr-FR locale");
{
  const s = formatProformaMoney(99.99, "USD");
  assertEq("non-empty", s.length > 0, true);
}

section("4. formatProformaMoney: invalid currency falls back to '<num>.toFixed(2) <code>'");
{
  // Empty currency makes Intl.NumberFormat throw → falls into catch branch.
  const s = formatProformaMoney(50, "");
  assertEq("expected fallback", s, "50.00 ");
}

section("5. formatProformaMoney: zero formats without throwing");
{
  const s = formatProformaMoney(0, "EUR");
  assertEq("non-empty", s.length > 0, true);
}

section("6. formatProformaMoney: negative amount handled");
{
  const s = formatProformaMoney(-100, "EUR");
  assertEq("non-empty", s.length > 0, true);
  // Some negative indicator (locale-dependent: "-", "−", parens).
  assertEq("has negative marker", /[-−(]/.test(s), true);
}

section("7. formatProformaQty: integer vs fractional fraction digits");
{
  // minimumFractionDigits: 0, maximumFractionDigits: 2.
  const ten = formatProformaQty(10);
  assertEq("integer no decimals", ten, "10");

  const half = formatProformaQty(10.5);
  // fr-FR uses ',' decimal: "10,5"
  assertEq("half with comma", half.includes(",") || half.includes("."), true);
}

section("8. formatProformaQty: NBSPs normalized to regular space");
{
  const s = formatProformaQty(1234567);
  assertEq("no NNBSP", s.includes(" "), false);
  assertEq("no NBSP", s.includes(" "), false);
}

section("9. formatProformaQty: zero");
{
  assertEq("zero", formatProformaQty(0), "0");
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
