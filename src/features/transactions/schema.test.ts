import { transactionSchema } from "./schema";

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

const baseDate = "2026-04-15";

function pathHas(r: ReturnType<typeof transactionSchema.safeParse>, path: string): boolean {
  if (r.success) return false;
  return r.error.issues.some((i) => i.path.join(".") === path);
}

section("1. expense (business pays): minimum valid input parses");
{
  const r = transactionSchema.safeParse({
    kind: "expense",
    transaction_date: baseDate,
    amount: 100,
    currency: "TRY",
    expense_type_id: "exp-1",
    paid_by: "business",
    from_account_id: "acc-1",
  });
  assertEq("ok", r.success, true);
}

section("2. expense (partner pays): requires partner_id, rejects from_account_id");
{
  const r = transactionSchema.safeParse({
    kind: "expense",
    transaction_date: baseDate,
    amount: 100,
    currency: "TRY",
    expense_type_id: "exp-1",
    paid_by: "partner",
    partner_id: "p-1",
  });
  assertEq("ok", r.success, true);
}

section("3. expense (partner pays): without partner_id fails");
{
  const r = transactionSchema.safeParse({
    kind: "expense",
    transaction_date: baseDate,
    amount: 100,
    currency: "TRY",
    expense_type_id: "exp-1",
    paid_by: "partner",
  });
  assertEq("rejected", r.success, false);
  assertEq("partner_id error", pathHas(r, "partner_id"), true);
}

section("4. expense (business pays): without from_account_id fails");
{
  const r = transactionSchema.safeParse({
    kind: "expense",
    transaction_date: baseDate,
    amount: 100,
    currency: "TRY",
    expense_type_id: "exp-1",
    paid_by: "business",
  });
  assertEq("rejected", r.success, false);
  assertEq("from_account_id error", pathHas(r, "from_account_id"), true);
}

section("5. expense (business pays): rejects partner_id when set");
{
  const r = transactionSchema.safeParse({
    kind: "expense",
    transaction_date: baseDate,
    amount: 100,
    currency: "TRY",
    expense_type_id: "exp-1",
    paid_by: "business",
    from_account_id: "a",
    partner_id: "p-1",
  });
  assertEq("rejected", r.success, false);
  assertEq("partner_id error", pathHas(r, "partner_id"), true);
}

section("6. expense (partner pays): rejects from_account_id and contact_id");
{
  const r = transactionSchema.safeParse({
    kind: "expense",
    transaction_date: baseDate,
    amount: 100,
    currency: "TRY",
    expense_type_id: "exp-1",
    paid_by: "partner",
    partner_id: "p-1",
    from_account_id: "a",
    contact_id: "c-1",
  });
  assertEq("rejected", r.success, false);
  assertEq("from_account_id error", pathHas(r, "from_account_id"), true);
  assertEq("contact_id error", pathHas(r, "contact_id"), true);
}

section("7. supplier_invoice: requires reference_number (invoice number)");
{
  const r = transactionSchema.safeParse({
    kind: "supplier_invoice",
    transaction_date: baseDate,
    amount: 100,
    currency: "TRY",
    contact_id: "c-1",
  });
  assertEq("rejected", r.success, false);
  assertEq("reference_number error", pathHas(r, "reference_number"), true);
}

section("8. supplier_invoice: with reference_number passes");
{
  const r = transactionSchema.safeParse({
    kind: "supplier_invoice",
    transaction_date: baseDate,
    amount: 100,
    currency: "TRY",
    contact_id: "c-1",
    reference_number: "INV-2026-001",
  });
  assertEq("ok", r.success, true);
}

section("9. supplier_invoice: whitespace-only reference rejected");
{
  const r = transactionSchema.safeParse({
    kind: "supplier_invoice",
    transaction_date: baseDate,
    amount: 100,
    currency: "TRY",
    contact_id: "c-1",
    reference_number: "   ",
  });
  assertEq("rejected", r.success, false);
}

section("10. amount: zero rejected (must be positive)");
{
  const r = transactionSchema.safeParse({
    kind: "other_income",
    transaction_date: baseDate,
    amount: 0,
    currency: "TRY",
    to_account_id: "a-1",
  });
  assertEq("rejected", r.success, false);
  assertEq("amount error", pathHas(r, "amount"), true);
}

section("11. amount: negative rejected");
{
  const r = transactionSchema.safeParse({
    kind: "other_income",
    transaction_date: baseDate,
    amount: -10,
    currency: "TRY",
    to_account_id: "a-1",
  });
  assertEq("rejected", r.success, false);
}

section("12. amount: empty string rejected");
{
  const r = transactionSchema.safeParse({
    kind: "other_income",
    transaction_date: baseDate,
    amount: "",
    currency: "TRY",
    to_account_id: "a-1",
  });
  assertEq("rejected", r.success, false);
}

section("13. amount: numeric string accepted (preprocess coerces)");
{
  const r = transactionSchema.safeParse({
    kind: "other_income",
    transaction_date: baseDate,
    amount: "150.5",
    currency: "TRY",
    to_account_id: "a-1",
  });
  assertEq("ok", r.success, true);
  if (r.success) {
    assertEq("coerced to number", r.data.amount, 150.5);
  }
}

section("14. transaction_date: bad shape rejected with friendly message");
{
  const r = transactionSchema.safeParse({
    kind: "other_income",
    transaction_date: "not-a-date",
    amount: 1,
    currency: "TRY",
    to_account_id: "a-1",
  });
  assertEq("rejected", r.success, false);
  assertEq("date error", pathHas(r, "transaction_date"), true);
}

section("15. tax_payment: kdv_period must be YYYY-MM if present");
{
  const ok = transactionSchema.safeParse({
    kind: "tax_payment",
    transaction_date: baseDate,
    amount: 100,
    currency: "TRY",
    from_account_id: "a-1",
    kdv_period: "2026-04",
  });
  assertEq("valid YYYY-MM", ok.success, true);

  const bad = transactionSchema.safeParse({
    kind: "tax_payment",
    transaction_date: baseDate,
    amount: 100,
    currency: "TRY",
    from_account_id: "a-1",
    kdv_period: "2026-13", // month 13 invalid
  });
  assertEq("rejected", bad.success, false);

  const empty = transactionSchema.safeParse({
    kind: "tax_payment",
    transaction_date: baseDate,
    amount: 100,
    currency: "TRY",
    from_account_id: "a-1",
    kdv_period: "",
  });
  assertEq("empty allowed", empty.success, true);
}

section("16. client_payment: differing currency requires fx_rate_applied");
{
  const r = transactionSchema.safeParse({
    kind: "client_payment",
    transaction_date: baseDate,
    amount: 1000,
    currency: "USD",
    contact_id: "c-1",
    contact_balance_currency: "EUR",
    to_account_id: "a-1",
  });
  assertEq("rejected", r.success, false);
  assertEq("fx_rate error", pathHas(r, "fx_rate_applied"), true);
}

section("17. client_payment: same currency does not require fx_rate");
{
  const r = transactionSchema.safeParse({
    kind: "client_payment",
    transaction_date: baseDate,
    amount: 1000,
    currency: "USD",
    contact_id: "c-1",
    contact_balance_currency: "USD",
    to_account_id: "a-1",
  });
  assertEq("ok", r.success, true);
}

section("18. unknown kind rejected (enum gate)");
{
  const r = transactionSchema.safeParse({
    kind: "totally_made_up",
    transaction_date: baseDate,
    amount: 100,
    currency: "TRY",
  });
  assertEq("rejected", r.success, false);
}

section("19. expense: vat_rate must be a known KDV rate");
{
  const ok = transactionSchema.safeParse({
    kind: "expense",
    transaction_date: baseDate,
    amount: 100,
    currency: "TRY",
    expense_type_id: "exp-1",
    paid_by: "business",
    from_account_id: "a-1",
    vat_rate: 20,
  });
  assertEq("known rate", ok.success, true);

  const bad = transactionSchema.safeParse({
    kind: "expense",
    transaction_date: baseDate,
    amount: 100,
    currency: "TRY",
    expense_type_id: "exp-1",
    paid_by: "business",
    from_account_id: "a-1",
    vat_rate: 17, // not a Turkish KDV rate
  });
  assertEq("rejected", bad.success, false);
}

section("20. expense: vat_rate null is allowed");
{
  const r = transactionSchema.safeParse({
    kind: "expense",
    transaction_date: baseDate,
    amount: 100,
    currency: "TRY",
    expense_type_id: "exp-1",
    paid_by: "business",
    from_account_id: "a-1",
    vat_rate: null,
  });
  assertEq("ok", r.success, true);
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
