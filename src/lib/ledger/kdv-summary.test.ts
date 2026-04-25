import { summarizeKdv, type KdvInputTxn } from "./kdv-summary";

let passed = 0;
let failed = 0;

function approx(a: number, b: number, eps = 0.001): boolean {
  return Math.abs(a - b) < eps;
}

function assertEq<T>(label: string, actual: T, expected: T): void {
  const ok =
    typeof actual === "number" && typeof expected === "number"
      ? approx(actual, expected)
      : JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    passed += 1;
    console.log(`  \u2713 ${label}`);
  } else {
    failed += 1;
    console.log(
      `  \u2717 ${label}\n    expected: ${JSON.stringify(expected)}\n    actual:   ${JSON.stringify(actual)}`,
    );
  }
}

function section(title: string): void {
  console.log(`\n${title}`);
}

function billing(
  id: string,
  date: string,
  vat: number | null,
  currency: string = "TRY",
): KdvInputTxn {
  return {
    id,
    transaction_date: date,
    kind: "shipment_billing",
    currency,
    vat_amount: vat,
    kdv_period: null,
    reference_number: null,
  };
}

function expense(
  id: string,
  date: string,
  vat: number | null,
  currency: string = "TRY",
): KdvInputTxn {
  return {
    id,
    transaction_date: date,
    kind: "expense",
    currency,
    vat_amount: vat,
    kdv_period: null,
    reference_number: null,
  };
}

function invoice(
  id: string,
  date: string,
  vat: number | null,
  currency: string = "TRY",
): KdvInputTxn {
  return {
    id,
    transaction_date: date,
    kind: "supplier_invoice",
    currency,
    vat_amount: vat,
    kdv_period: null,
    reference_number: null,
  };
}

function taxPayment(
  id: string,
  date: string,
  period: string,
  reference: string | null = null,
): KdvInputTxn {
  return {
    id,
    transaction_date: date,
    kind: "tax_payment",
    currency: "TRY",
    vat_amount: null,
    kdv_period: period,
    reference_number: reference,
  };
}

// Fixed "now" so period math is deterministic.
// Istanbul month for this instant is "2026-04".
const NOW = new Date("2026-04-15T12:00:00Z");

section("1. Empty input -> 12 zero rows, all unfiled");
{
  const r = summarizeKdv([], 12, NOW);
  assertEq("row count", r.length, 12);
  assertEq("newest period", r[0].period, "2026-04");
  assertEq("oldest period", r[11].period, "2025-05");
  assertEq("all unfiled", r.every((m) => m.status === "unfiled"), true);
  assertEq("all zero collected", r.every((m) => m.collected_vat_try === 0), true);
  assertEq("all zero paid", r.every((m) => m.paid_vat_try === 0), true);
  assertEq("all zero skipped", r.every((m) => m.skipped_count === 0), true);
}

section("2. Collected-only (shipment_billing TRY) -> net positive");
{
  const r = summarizeKdv(
    [billing("b1", "2026-04-10", 420)],
    12,
    NOW,
  );
  assertEq("period 2026-04 collected", r[0].collected_vat_try, 420);
  assertEq("period 2026-04 paid", r[0].paid_vat_try, 0);
  assertEq("period 2026-04 net positive", r[0].net_try, 420);
  assertEq("period 2026-04 unfiled", r[0].status, "unfiled");
}

section("3. Paid-only (expense TRY) -> net negative (carry-forward)");
{
  const r = summarizeKdv(
    [expense("e1", "2026-04-03", 196.67)],
    12,
    NOW,
  );
  assertEq("collected", r[0].collected_vat_try, 0);
  assertEq("paid", r[0].paid_vat_try, 196.67);
  assertEq("net negative", r[0].net_try, -196.67);
}

section("4. Mixed month -> collected - paid");
{
  const r = summarizeKdv(
    [
      billing("b1", "2026-03-15", 2000),
      expense("e1", "2026-03-20", 800),
      invoice("i1", "2026-03-25", 500),
    ],
    12,
    NOW,
  );
  const mar = r.find((m) => m.period === "2026-03")!;
  assertEq("collected", mar.collected_vat_try, 2000);
  assertEq("paid", mar.paid_vat_try, 1300);
  assertEq("net", mar.net_try, 700);
}

section("5. Non-TRY VAT -> skipped_count, not summed");
{
  const r = summarizeKdv(
    [
      expense("e1", "2026-04-05", 100, "EUR"),
      expense("e2", "2026-04-06", 200, "TRY"),
    ],
    12,
    NOW,
  );
  assertEq("paid (TRY only)", r[0].paid_vat_try, 200);
  assertEq("skipped count", r[0].skipped_count, 1);
}

section("6. vat_amount null -> neither summed nor skipped");
{
  const r = summarizeKdv(
    [
      expense("e1", "2026-04-05", null, "TRY"),
      expense("e2", "2026-04-06", null, "EUR"),
    ],
    12,
    NOW,
  );
  assertEq("paid", r[0].paid_vat_try, 0);
  assertEq("skipped (null excluded)", r[0].skipped_count, 0);
}

section("7. Filed: tax_payment with matching period");
{
  const r = summarizeKdv(
    [
      expense("e1", "2026-02-10", 500),
      taxPayment("p1", "2026-04-20", "2026-02", "BEYAN-2026-02"),
    ],
    12,
    NOW,
  );
  const feb = r.find((m) => m.period === "2026-02")!;
  assertEq("status", feb.status, "filed");
  assertEq("linked id", feb.linked_payment_id, "p1");
  assertEq("linked reference", feb.linked_payment_reference, "BEYAN-2026-02");
}

section("8. Multiple tax_payments for same period -> newest wins");
{
  const r = summarizeKdv(
    [
      taxPayment("p1", "2026-04-05", "2026-02", "OLDER"),
      taxPayment("p2", "2026-04-20", "2026-02", "NEWER"),
      taxPayment("p3", "2026-04-20", "2026-02", "TIEBREAK-HIGHER-ID"),
    ],
    12,
    NOW,
  );
  const feb = r.find((m) => m.period === "2026-02")!;
  assertEq("status filed", feb.status, "filed");
  assertEq("newest by date wins (id tie-break)", feb.linked_payment_id, "p3");
  assertEq("reference follows", feb.linked_payment_reference, "TIEBREAK-HIGHER-ID");
}

section("9. Outside window -> ignored");
{
  const r = summarizeKdv(
    [expense("e_old", "2024-06-01", 999)],
    12,
    NOW,
  );
  assertEq("oldest period 2025-05 paid", r[11].paid_vat_try, 0);
  assertEq("any window has nonzero?", r.some((m) => m.paid_vat_try > 0), false);
}

section("10. Month boundary (YYYY-MM-DD) in Istanbul TZ");
{
  const r = summarizeKdv(
    [
      expense("e1", "2026-04-01", 100),
      expense("e2", "2026-03-31", 50),
    ],
    12,
    NOW,
  );
  const apr = r.find((m) => m.period === "2026-04")!;
  const mar = r.find((m) => m.period === "2026-03")!;
  assertEq("april picks up the 1st", apr.paid_vat_try, 100);
  assertEq("march picks up the 31st", mar.paid_vat_try, 50);
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
