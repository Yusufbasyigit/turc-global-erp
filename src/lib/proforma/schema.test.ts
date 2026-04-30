import {
  proformaFormSchema,
  getMissingProformaFields,
} from "./schema";

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

section("1. proformaFormSchema: empty object parses with all-null output");
{
  const r = proformaFormSchema.safeParse({});
  assertEq("ok", r.success, true);
}

section("2. proformaFormSchema: trims and folds whitespace strings to null");
{
  const r = proformaFormSchema.parse({
    incoterm: "  ",
    payment_terms: "",
  });
  assertEq("blank incoterm -> null", r.incoterm, null);
  assertEq("blank payment_terms -> null", r.payment_terms, null);
}

section("3. proformaFormSchema: trims real strings");
{
  const r = proformaFormSchema.parse({
    incoterm: "  FOB Mersin  ",
  });
  assertEq("trimmed", r.incoterm, "FOB Mersin");
}

section("4. proformaFormSchema: valid date passes; non-ISO date fails");
{
  const ok = proformaFormSchema.safeParse({ offer_date: "2026-04-25" });
  assertEq("valid date ok", ok.success, true);

  const bad = proformaFormSchema.safeParse({ offer_date: "25/04/2026" });
  assertEq("DD/MM/YYYY rejected", bad.success, false);
  if (!bad.success) {
    const msg = bad.error.issues[0]?.message ?? "";
    assertEq("error mentions YYYY-MM-DD", msg.includes("YYYY-MM-DD"), true);
  }
}

section("5. proformaFormSchema: blank date string passes (transformed to null)");
{
  const r = proformaFormSchema.parse({ offer_date: "" });
  assertEq("blank -> null", r.offer_date, null);
}

section("6. getMissingProformaFields: all present -> []");
{
  const missing = getMissingProformaFields({
    offer_date: "2026-04-25",
    incoterm: "FOB",
    payment_terms: "Net 30",
  });
  assertEq("none missing", missing, []);
}

section("7. getMissingProformaFields: nulls reported with human label");
{
  const missing = getMissingProformaFields({
    offer_date: null,
    incoterm: null,
    payment_terms: null,
  });
  assertEq(
    "all 3 missing",
    missing,
    ["Offer date", "Incoterm", "Payment terms"],
  );
}

section("8. getMissingProformaFields: whitespace-only is reported missing");
{
  const missing = getMissingProformaFields({
    offer_date: "   ",
    incoterm: "FOB",
    payment_terms: "Net 30",
  });
  assertEq("blank string -> missing", missing, ["Offer date"]);
}

section("9. getMissingProformaFields: order of labels is stable (offer_date first)");
{
  const missing = getMissingProformaFields({
    offer_date: null,
    incoterm: null,
    payment_terms: "Net 30",
  });
  assertEq("stable order", missing, ["Offer date", "Incoterm"]);
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
