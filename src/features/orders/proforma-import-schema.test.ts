import {
  proformaImportSchema,
  proformaLineSchema,
} from "./proforma-import-schema";

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

const validLine = {
  line_number: 1,
  description: "Hazelnut whole 50%",
  primary_quantity: 100,
  primary_unit: "kg",
  unit_price: 12.5,
  line_total: 1250,
  proposed_product_name: "Hazelnut Whole 50%",
};

section("1. proformaLineSchema: minimum valid line parses");
{
  const r = proformaLineSchema.safeParse(validLine);
  assertEq("ok", r.success, true);
}

section("2. proformaLineSchema: line_number must be positive integer");
{
  const bad = proformaLineSchema.safeParse({ ...validLine, line_number: 0 });
  assertEq("zero rejected", bad.success, false);

  const float = proformaLineSchema.safeParse({ ...validLine, line_number: 1.5 });
  assertEq("float rejected", float.success, false);
}

section("3. proformaLineSchema: description must not be empty");
{
  const r = proformaLineSchema.safeParse({ ...validLine, description: "" });
  assertEq("rejected", r.success, false);
}

section("4. proformaLineSchema: primary_quantity must be positive (zero rejected)");
{
  const zero = proformaLineSchema.safeParse({ ...validLine, primary_quantity: 0 });
  assertEq("zero rejected", zero.success, false);

  const neg = proformaLineSchema.safeParse({ ...validLine, primary_quantity: -1 });
  assertEq("negative rejected", neg.success, false);
}

section("5. proformaLineSchema: unit_price=0 allowed (free sample line)");
{
  const r = proformaLineSchema.safeParse({ ...validLine, unit_price: 0 });
  assertEq("ok", r.success, true);
}

section("6. proformaLineSchema: line_total may not be negative");
{
  const r = proformaLineSchema.safeParse({ ...validLine, line_total: -1 });
  assertEq("rejected", r.success, false);
}

section("7. proformaLineSchema: proposed_product_name length cap (120)");
{
  const long = "x".repeat(121);
  const r = proformaLineSchema.safeParse({
    ...validLine,
    proposed_product_name: long,
  });
  assertEq("rejected", r.success, false);
}

section("8. proformaLineSchema: line_currency must be exactly 3 chars when present");
{
  const ok = proformaLineSchema.safeParse({ ...validLine, line_currency: "EUR" });
  assertEq("3-letter ok", ok.success, true);

  const lower = proformaLineSchema.safeParse({ ...validLine, line_currency: "eur" });
  assertEq("lowercase normalized", lower.success, true);
  if (lower.success) {
    assertEq("upper-cased", lower.data.line_currency, "EUR");
  }

  const tooShort = proformaLineSchema.safeParse({
    ...validLine,
    line_currency: "EU",
  });
  assertEq("2-letter rejected", tooShort.success, false);
}

section("9. proformaLineSchema: nullable fields default to null when absent");
{
  const r = proformaLineSchema.parse(validLine);
  assertEq("supplier_sku null", r.supplier_sku, null);
  assertEq("hs_code null", r.hs_code, null);
  assertEq("notes null", r.notes, null);
  assertEq("secondary_quantities null", r.secondary_quantities, null);
}

section("10. proformaImportSchema: empty lines array rejected");
{
  const r = proformaImportSchema.safeParse({
    lines: [],
  });
  assertEq("rejected", r.success, false);
}

section("11. proformaImportSchema: 1+ lines required");
{
  const r = proformaImportSchema.safeParse({
    lines: [validLine],
  });
  assertEq("ok", r.success, true);
}

section("12. proformaImportSchema: currency at root upper-cased + 3 chars");
{
  const ok = proformaImportSchema.safeParse({
    currency: "usd",
    lines: [validLine],
  });
  assertEq("ok", ok.success, true);
  if (ok.success) {
    assertEq("uppercased", ok.data.currency, "USD");
  }

  const bad = proformaImportSchema.safeParse({
    currency: "TOOLONG",
    lines: [validLine],
  });
  assertEq("rejected", bad.success, false);
}

section("13. proformaImportSchema: totals nullable + nested nullable numbers");
{
  const r = proformaImportSchema.safeParse({
    totals: { subtotal: null, vat_amount: null, grand_total: null },
    lines: [validLine],
  });
  assertEq("ok", r.success, true);

  const r2 = proformaImportSchema.safeParse({
    totals: null,
    lines: [validLine],
  });
  assertEq("totals=null ok", r2.success, true);
}

section("14. proformaImportSchema: garbage shape (missing lines) rejected");
{
  const r = proformaImportSchema.safeParse({
    proforma_reference: "PR-001",
  });
  assertEq("rejected", r.success, false);
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
