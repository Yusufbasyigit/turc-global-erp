import { notesFromLine, hasLineMathMismatch } from "./proforma-helpers";

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

section("1. notesFromLine: empty input -> null");
{
  assertEq("all empty", notesFromLine({}), null);
}

section("2. notesFromLine: SKU only -> 'SKU: <value>'");
{
  assertEq("sku", notesFromLine({ supplier_sku: "ABC-123" }), "SKU: ABC-123");
}

section("3. notesFromLine: SKU is trimmed");
{
  assertEq("trimmed", notesFromLine({ supplier_sku: "  ABC  " }), "SKU: ABC");
}

section("4. notesFromLine: blank/whitespace SKU is dropped");
{
  assertEq("blank", notesFromLine({ supplier_sku: "   " }), null);
  assertEq("empty", notesFromLine({ supplier_sku: "" }), null);
}

section("5. notesFromLine: secondary_quantities serialized as 'k: v · k: v'");
{
  const out = notesFromLine({
    secondary_quantities: { pallets: 2, cartons: 10 },
  });
  // Object key order is preserved in modern JS for string keys.
  assertEq("expected", out, "pallets: 2 · cartons: 10");
}

section("6. notesFromLine: combination of all fields with ' · ' separator");
{
  const out = notesFromLine({
    supplier_sku: "X",
    secondary_quantities: { kg: 5 },
    notes: "fragile",
  });
  assertEq("combined", out, "SKU: X · kg: 5 · fragile");
}

section("7. notesFromLine: notes is trimmed");
{
  assertEq("trimmed notes", notesFromLine({ notes: "  hello  " }), "hello");
}

section("8. notesFromLine: notes whitespace-only is dropped");
{
  assertEq("blank notes", notesFromLine({ notes: "   " }), null);
}

section("9. notesFromLine: secondary_quantities empty object yields null");
{
  // Empty object → no entries → no pieces → null.
  assertEq("empty obj", notesFromLine({ secondary_quantities: {} }), null);
}

section("10. hasLineMathMismatch: matching qty * unit_price returns null");
{
  const r = hasLineMathMismatch({
    primary_quantity: 10,
    unit_price: 5,
    parsed_line_total: 50,
  });
  assertEq("ok", r, null);
}

section("11. hasLineMathMismatch: 0.01 tolerance accepts rounding noise");
{
  const ok1 = hasLineMathMismatch({
    primary_quantity: 3,
    unit_price: 1.111,
    parsed_line_total: 3.333,
  });
  // 3 * 1.111 = 3.333, exact match; null
  assertEq("exact match", ok1, null);

  const ok2 = hasLineMathMismatch({
    primary_quantity: 3,
    unit_price: 1.111,
    parsed_line_total: 3.34,
  });
  // 3.333 vs 3.34 = 0.007 diff -> within 0.01 tolerance, null
  assertEq("near match", ok2, null);
}

section("12. hasLineMathMismatch: diff > 0.01 returns mismatch object with both numbers");
{
  const r = hasLineMathMismatch({
    primary_quantity: 10,
    unit_price: 5,
    parsed_line_total: 49,
  });
  assertEq("non-null", r !== null, true);
  if (r) {
    assertEq("stated", r.stated, 49);
    assertEq("computed", r.computed, 50);
    assertEq("message has 49.00", r.message.includes("49.00"), true);
    assertEq("message has 50.00", r.message.includes("50.00"), true);
  }
}

section("13. hasLineMathMismatch: zero qty * unit_price = 0; nonzero stated -> mismatch");
{
  const r = hasLineMathMismatch({
    primary_quantity: 0,
    unit_price: 5,
    parsed_line_total: 10,
  });
  assertEq("mismatch", r !== null, true);
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
