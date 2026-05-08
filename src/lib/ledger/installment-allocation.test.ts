import {
  allocateRealEstateInstallments,
  type RealEstateInstallmentInput,
  type RealEstateReceiptInput,
} from "./installment-allocation";

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

function inst(
  id: string,
  due_date: string,
  expected_amount: number,
  sequence: number,
): RealEstateInstallmentInput {
  return { id, due_date, expected_amount, sequence };
}

function receipt(id: string, date: string, amount: number): RealEstateReceiptInput {
  return { id, date, amount };
}

const TODAY = "2026-04-30";

section("1. Empty inputs -> zero totals, zero installments");
{
  const r = allocateRealEstateInstallments([], [], TODAY);
  assertEq("installments empty", r.installments.length, 0);
  assertEq("total_expected", r.total_expected, 0);
  assertEq("total_paid", r.total_paid, 0);
  assertEq("total_outstanding", r.total_outstanding, 0);
  assertEq("unallocated", r.unallocated_payment, 0);
}

section("2. Single installment, no receipts -> due (future) or overdue (past)");
{
  const future = allocateRealEstateInstallments(
    [inst("i1", "2026-12-01", 1000, 1)],
    [],
    TODAY,
  );
  assertEq("future status", future.installments[0].status, "due");
  assertEq("future outstanding", future.installments[0].outstanding, 1000);

  const past = allocateRealEstateInstallments(
    [inst("i1", "2026-01-01", 1000, 1)],
    [],
    TODAY,
  );
  assertEq("past status", past.installments[0].status, "overdue");
  assertEq("past paid", past.installments[0].paid, 0);
}

section("3. Exact full payment -> paid, no rounding residue");
{
  const r = allocateRealEstateInstallments(
    [inst("i1", "2026-01-01", 1000, 1)],
    [receipt("r1", "2026-01-15", 1000)],
    TODAY,
  );
  assertEq("status", r.installments[0].status, "paid");
  assertEq("outstanding", r.installments[0].outstanding, 0);
  assertEq("paid", r.installments[0].paid, 1000);
  assertEq("unallocated", r.unallocated_payment, 0);
}

section("4. Partial payment -> partial status, paid > 0, outstanding > 0");
{
  const r = allocateRealEstateInstallments(
    [inst("i1", "2026-12-01", 1000, 1)],
    [receipt("r1", "2026-01-15", 300)],
    TODAY,
  );
  assertEq("status", r.installments[0].status, "partial");
  assertEq("paid", r.installments[0].paid, 300);
  assertEq("outstanding", r.installments[0].outstanding, 700);
}

section("5. FIFO across multiple installments");
{
  const r = allocateRealEstateInstallments(
    [
      inst("i1", "2026-01-01", 500, 1),
      inst("i2", "2026-02-01", 500, 2),
      inst("i3", "2026-03-01", 500, 3),
    ],
    [receipt("r1", "2026-01-15", 1200)],
    TODAY,
  );
  assertEq("i1 paid", r.installments[0].paid, 500);
  assertEq("i1 paid status", r.installments[0].status, "paid");
  assertEq("i2 paid", r.installments[1].paid, 500);
  assertEq("i2 paid status", r.installments[1].status, "paid");
  assertEq("i3 partial paid", r.installments[2].paid, 200);
  // i3 is past due (2026-03-01 < TODAY 2026-04-30) so overdue beats partial.
  assertEq("i3 status", r.installments[2].status, "overdue");
}

section("6. Overpayment -> unallocated_payment carries the residue");
{
  const r = allocateRealEstateInstallments(
    [inst("i1", "2026-01-01", 100, 1)],
    [receipt("r1", "2026-01-15", 250)],
    TODAY,
  );
  assertEq("paid full", r.installments[0].paid, 100);
  assertEq("unallocated", r.unallocated_payment, 150);
}

section("7. Receipts FIFO by date (oldest first)");
{
  const r = allocateRealEstateInstallments(
    [
      inst("i1", "2026-01-01", 100, 1),
      inst("i2", "2026-02-01", 100, 2),
    ],
    [
      receipt("rB", "2026-02-01", 50), // later -> applied second
      receipt("rA", "2026-01-15", 100), // earlier -> applied first
    ],
    TODAY,
  );
  assertEq("i1 fully paid", r.installments[0].paid, 100);
  assertEq("i2 partial paid", r.installments[1].paid, 50);
}

section("8. Tie-break by id when dates equal");
{
  const r = allocateRealEstateInstallments(
    [
      inst("ZZZ", "2026-01-01", 100, 1),
      inst("AAA", "2026-01-01", 100, 1),
    ],
    [receipt("r1", "2026-01-15", 100)],
    TODAY,
  );
  // AAA sorts before ZZZ -> AAA paid first
  const aaa = r.installments.find((s) => s.installment_id === "AAA")!;
  const zzz = r.installments.find((s) => s.installment_id === "ZZZ")!;
  assertEq("AAA paid first", aaa.paid, 100);
  assertEq("ZZZ untouched", zzz.paid, 0);
}

section("9. Sequence breaks ties when dates equal");
{
  const r = allocateRealEstateInstallments(
    [
      inst("i1", "2026-01-01", 100, 2),
      inst("i2", "2026-01-01", 100, 1),
    ],
    [receipt("r1", "2026-01-15", 100)],
    TODAY,
  );
  // sequence 1 (i2) sorts before sequence 2 (i1)
  const seq1 = r.installments.find((s) => s.sequence === 1)!;
  const seq2 = r.installments.find((s) => s.sequence === 2)!;
  assertEq("seq=1 paid first", seq1.paid, 100);
  assertEq("seq=2 untouched", seq2.paid, 0);
}

section("10. Floating-point safety (EPS=0.001)");
{
  // Three receipts of 33.333 -> ~99.999, leaves a sub-EPS residue.
  const r = allocateRealEstateInstallments(
    [inst("i1", "2026-12-01", 100, 1)],
    [
      receipt("r1", "2026-01-15", 33.333),
      receipt("r2", "2026-01-16", 33.333),
      receipt("r3", "2026-01-17", 33.333),
    ],
    TODAY,
  );
  // outstanding within EPS -> still classified as partial (not paid)
  // because abs(outstanding) > 0 here (~0.001).
  assertEq("paid sums", approx(r.installments[0].paid, 99.999), true);
  assertEq("unallocated zero", r.unallocated_payment, 0);
}

section("11. Totals roll up across installments");
{
  const r = allocateRealEstateInstallments(
    [
      inst("i1", "2026-01-01", 100, 1),
      inst("i2", "2026-02-01", 200, 2),
      inst("i3", "2026-03-01", 300, 3),
    ],
    [receipt("r1", "2026-01-15", 250)],
    TODAY,
  );
  assertEq("total_expected", r.total_expected, 600);
  assertEq("total_paid", r.total_paid, 250);
  assertEq("total_outstanding", r.total_outstanding, 350);
}

section("12. Receipts continue across multiple installments in one go");
{
  const r = allocateRealEstateInstallments(
    [
      inst("i1", "2026-01-01", 100, 1),
      inst("i2", "2026-02-01", 100, 2),
      inst("i3", "2026-03-01", 100, 3),
    ],
    [receipt("r1", "2026-01-15", 250)],
    TODAY,
  );
  assertEq("i1 fully paid", r.installments[0].status, "paid");
  assertEq("i2 fully paid", r.installments[1].status, "paid");
  // i3 is past due (2026-03-01 < TODAY 2026-04-30) so overdue beats partial.
  assertEq("i3 overdue (was partial pre-fix)", r.installments[2].status, "overdue");
  assertEq("i3 paid", r.installments[2].paid, 50);
}

section("13. Zero-amount receipt -> noop, no division by anything");
{
  const r = allocateRealEstateInstallments(
    [inst("i1", "2026-12-01", 100, 1)],
    [receipt("r1", "2026-01-15", 0)],
    TODAY,
  );
  assertEq("paid", r.installments[0].paid, 0);
  assertEq("outstanding", r.installments[0].outstanding, 100);
  assertEq("status", r.installments[0].status, "due");
}

section("14b. Partially-paid installment past due -> overdue beats partial");
{
  const r = allocateRealEstateInstallments(
    [inst("i1", "2026-01-01", 1000, 1)],
    [receipt("r1", "2026-01-15", 300)],
    TODAY,
  );
  assertEq("paid", r.installments[0].paid, 300);
  assertEq("outstanding", r.installments[0].outstanding, 700);
  assertEq("status", r.installments[0].status, "overdue");
}

section("14. Zero-amount installment -> immediately paid");
{
  const r = allocateRealEstateInstallments(
    [inst("i1", "2026-12-01", 0, 1)],
    [],
    TODAY,
  );
  // outstanding is 0 -> classified as paid.
  assertEq("status", r.installments[0].status, "paid");
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
