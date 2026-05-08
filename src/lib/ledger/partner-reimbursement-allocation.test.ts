import {
  allocatePartnerReimbursements,
  type ReimbursementClaim,
  type ReimbursementPayout,
} from "./partner-reimbursement-allocation";

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

function claim(
  id: string,
  date: string,
  amount: number,
  currency: string,
  description: string | null = null,
): ReimbursementClaim {
  return { id, date, amount, currency, description };
}

function payout(
  id: string,
  date: string,
  amount: number,
  currency: string,
): ReimbursementPayout {
  return { id, date, amount, currency };
}

function section(title: string): void {
  console.log(`\n${title}`);
}

section("1. No payouts -> all claims outstanding");
{
  const r = allocatePartnerReimbursements(
    [
      claim("c1", "2026-01-01", 100, "TRY"),
      claim("c2", "2026-01-05", 450, "TRY"),
    ],
    [],
  );
  const bucket = r.by_currency["TRY"];
  assertEq("bucket present", Boolean(bucket), true);
  assertEq("total_claimed", bucket.total_claimed, 550);
  assertEq("total_paid", bucket.total_paid, 0);
  assertEq("total_outstanding", bucket.total_outstanding, 550);
  assertEq("c1 outstanding", bucket.claim_allocations[0].outstanding, 100);
  assertEq("c2 outstanding", bucket.claim_allocations[1].outstanding, 450);
  assertEq("unallocated_payout", bucket.unallocated_payout, 0);
}

section("2. Exact match in one currency -> all settled");
{
  const r = allocatePartnerReimbursements(
    [
      claim("c1", "2026-01-01", 100, "TRY"),
      claim("c2", "2026-01-02", 450, "TRY"),
      claim("c3", "2026-01-03", 200, "TRY"),
    ],
    [payout("p1", "2026-01-10", 750, "TRY")],
  );
  const bucket = r.by_currency["TRY"];
  assertEq("total_outstanding", bucket.total_outstanding, 0);
  assertEq("c1 settled", bucket.claim_allocations[0].is_fully_settled, true);
  assertEq("c2 settled", bucket.claim_allocations[1].is_fully_settled, true);
  assertEq("c3 settled", bucket.claim_allocations[2].is_fully_settled, true);
  assertEq("unallocated", bucket.unallocated_payout, 0);
}

section("3. Partial payout -> oldest fully settled, next partial, rest outstanding");
{
  const r = allocatePartnerReimbursements(
    [
      claim("c1", "2026-01-01", 100, "TRY"),
      claim("c2", "2026-01-02", 450, "TRY"),
      claim("c3", "2026-01-03", 200, "TRY"),
    ],
    [payout("p1", "2026-01-10", 600, "TRY")],
  );
  const bucket = r.by_currency["TRY"];
  assertEq("c1 fully settled", bucket.claim_allocations[0].is_fully_settled, true);
  assertEq("c1 settled amount", bucket.claim_allocations[0].amount_settled, 100);
  assertEq("c2 fully settled", bucket.claim_allocations[1].is_fully_settled, true);
  assertEq("c2 settled amount", bucket.claim_allocations[1].amount_settled, 450);
  assertEq("c3 partial settled", bucket.claim_allocations[2].is_fully_settled, false);
  assertEq("c3 settled amount", bucket.claim_allocations[2].amount_settled, 50);
  assertEq("c3 outstanding", bucket.claim_allocations[2].outstanding, 150);
  assertEq("total_outstanding", bucket.total_outstanding, 150);
  assertEq("unallocated_payout", bucket.unallocated_payout, 0);
}

section("4. Overpayment -> all settled, unallocated_payout > 0");
{
  const r = allocatePartnerReimbursements(
    [claim("c1", "2026-01-01", 200, "TRY")],
    [payout("p1", "2026-01-10", 500, "TRY")],
  );
  const bucket = r.by_currency["TRY"];
  assertEq("c1 fully settled", bucket.claim_allocations[0].is_fully_settled, true);
  assertEq("total_outstanding", bucket.total_outstanding, 0);
  assertEq("unallocated_payout", bucket.unallocated_payout, 300);
}

section("5. Multi-currency independence");
{
  const r = allocatePartnerReimbursements(
    [
      claim("c1", "2026-01-01", 100, "TRY"),
      claim("c2", "2026-01-02", 50, "EUR"),
    ],
    [payout("p1", "2026-01-10", 100, "TRY")],
  );
  const tr = r.by_currency["TRY"];
  const eu = r.by_currency["EUR"];
  assertEq("TRY settled", tr.total_outstanding, 0);
  assertEq("EUR untouched", eu.total_outstanding, 50);
  assertEq("EUR payouts zero", eu.total_paid, 0);
  assertEq("EUR claim not settled", eu.claim_allocations[0].is_fully_settled, false);
}

section("6. Multiple payouts, FIFO preserved");
{
  const r = allocatePartnerReimbursements(
    [
      claim("c1", "2026-01-01", 100, "TRY"),
      claim("c2", "2026-01-02", 200, "TRY"),
    ],
    [
      payout("p1", "2026-01-05", 50, "TRY"),
      payout("p2", "2026-01-06", 150, "TRY"),
    ],
  );
  const bucket = r.by_currency["TRY"];
  assertEq("c1 fully settled", bucket.claim_allocations[0].is_fully_settled, true);
  assertEq("c1 settled", bucket.claim_allocations[0].amount_settled, 100);
  assertEq("c2 partial", bucket.claim_allocations[1].amount_settled, 100);
  assertEq("c2 outstanding", bucket.claim_allocations[1].outstanding, 100);
  assertEq("total_paid", bucket.total_paid, 200);
}

section("7. Payout in currency with no claims");
{
  const r = allocatePartnerReimbursements(
    [claim("c1", "2026-01-01", 100, "TRY")],
    [payout("p1", "2026-01-10", 50, "USD")],
  );
  const tr = r.by_currency["TRY"];
  const us = r.by_currency["USD"];
  assertEq("TRY outstanding", tr.total_outstanding, 100);
  assertEq("USD unallocated", us.unallocated_payout, 50);
  assertEq("USD has no claims", us.claim_allocations.length, 0);
}

section("8. Sub-cent rounding residue marks claim fully settled");
{
  // Three payouts that don't divide evenly into the claim. Without an EPS
  // tolerance, the residual ~1e-15 leaves is_fully_settled=false and the
  // claim re-surfaces in the pending list with $0.00 outstanding.
  const r = allocatePartnerReimbursements(
    [claim("c1", "2026-01-01", 100, "USD")],
    [
      payout("p1", "2026-01-02", 33.33, "USD"),
      payout("p2", "2026-01-03", 33.33, "USD"),
      payout("p3", "2026-01-04", 33.34, "USD"),
    ],
  );
  const bucket = r.by_currency["USD"];
  assertEq("fully settled", bucket.claim_allocations[0].is_fully_settled, true);
  assertEq("outstanding zeroed", bucket.claim_allocations[0].outstanding, 0);
  assertEq("no unallocated payout", bucket.unallocated_payout, 0);
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
