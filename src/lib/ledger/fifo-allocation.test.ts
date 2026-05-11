import { allocateFifo, type LedgerEvent } from "./fifo-allocation";

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

// `created_time` is required and non-null on `LedgerEvent`. Tests synthesize
// a deterministic per-id timestamp anchored to the event date so the FIFO
// sort's secondary key is stable and meaningful: same-date events sort by
// id (matching the constructor argument order), which is what every section
// below assumes.
function syntheticCreatedTime(id: string, date: string): string {
  return `${date}T00:00:00.000Z__${id}`;
}

function billing(
  id: string,
  date: string,
  amount: number,
  currency: string,
  shipmentId: string,
  fx?: { target: string; converted: number },
): LedgerEvent {
  return {
    id,
    date,
    created_time: syntheticCreatedTime(id, date),
    kind: "shipment_billing",
    amount,
    currency,
    related_shipment_id: shipmentId,
    fx_converted_amount: fx?.converted ?? null,
    fx_target_currency: fx?.target ?? null,
  };
}

function payment(
  id: string,
  date: string,
  amount: number,
  currency: string,
  fx?: { target: string; converted: number },
): LedgerEvent {
  return {
    id,
    date,
    created_time: syntheticCreatedTime(id, date),
    kind: "client_payment",
    amount,
    currency,
    related_shipment_id: null,
    fx_converted_amount: fx?.converted ?? null,
    fx_target_currency: fx?.target ?? null,
  };
}

function refund(
  id: string,
  date: string,
  amount: number,
  currency: string,
  fx?: { target: string; converted: number },
): LedgerEvent {
  return {
    id,
    date,
    created_time: syntheticCreatedTime(id, date),
    kind: "client_refund",
    amount,
    currency,
    related_shipment_id: null,
    fx_converted_amount: fx?.converted ?? null,
    fx_target_currency: fx?.target ?? null,
  };
}

function section(title: string): void {
  console.log(`\n${title}`);
}

section("1. No payments -> all outstanding");
{
  const r = allocateFifo(
    [billing("b1", "2026-01-01", 1000, "EUR", "s1")],
    "EUR",
  );
  assertEq("one allocation", r.shipment_allocations.length, 1);
  assertEq("paid", r.shipment_allocations[0].paid_amount, 0);
  assertEq("outstanding", r.shipment_allocations[0].outstanding_amount, 1000);
  assertEq("net_balance", r.net_balance, 1000);
  assertEq("unallocated_credit", r.unallocated_credit, 0);
}

section("2. Exact match -> outstanding 0");
{
  const r = allocateFifo(
    [
      billing("b1", "2026-01-01", 1000, "EUR", "s1"),
      payment("p1", "2026-01-02", 1000, "EUR"),
    ],
    "EUR",
  );
  assertEq("paid", r.shipment_allocations[0].paid_amount, 1000);
  assertEq("outstanding", r.shipment_allocations[0].outstanding_amount, 0);
  assertEq("fully_paid", r.shipment_allocations[0].is_fully_paid, true);
  assertEq("net_balance", r.net_balance, 0);
}

section("3. Overpayment -> unallocated_credit > 0");
{
  const r = allocateFifo(
    [
      billing("b1", "2026-01-01", 500, "EUR", "s1"),
      payment("p1", "2026-01-02", 800, "EUR"),
    ],
    "EUR",
  );
  assertEq("paid", r.shipment_allocations[0].paid_amount, 500);
  assertEq("outstanding", r.shipment_allocations[0].outstanding_amount, 0);
  assertEq("unallocated_credit", r.unallocated_credit, 300);
  assertEq("net_balance", r.net_balance, -300);
}

section("4. Partial payment");
{
  const r = allocateFifo(
    [
      billing("b1", "2026-01-01", 1000, "EUR", "s1"),
      payment("p1", "2026-01-02", 600, "EUR"),
    ],
    "EUR",
  );
  assertEq("paid", r.shipment_allocations[0].paid_amount, 600);
  assertEq("outstanding", r.shipment_allocations[0].outstanding_amount, 400);
  assertEq("fully_paid", r.shipment_allocations[0].is_fully_paid, false);
  assertEq("net_balance", r.net_balance, 400);
}

section("5. Rollover across two billings");
{
  const r = allocateFifo(
    [
      billing("b1", "2026-01-01", 500, "EUR", "s1"),
      billing("b2", "2026-01-15", 1000, "EUR", "s2"),
      payment("p1", "2026-01-20", 800, "EUR"),
    ],
    "EUR",
  );
  assertEq("b1 paid", r.shipment_allocations[0].paid_amount, 500);
  assertEq("b1 fully_paid", r.shipment_allocations[0].is_fully_paid, true);
  assertEq("b2 paid", r.shipment_allocations[1].paid_amount, 300);
  assertEq("b2 outstanding", r.shipment_allocations[1].outstanding_amount, 700);
  assertEq("net_balance", r.net_balance, 700);
  assertEq("payment allocations split into 2", r.payment_allocations.length, 2);
}

section("6. Mixed currency with frozen FX");
{
  const r = allocateFifo(
    [
      billing("b1", "2026-01-01", 1000, "EUR", "s1"),
      payment("p1", "2026-01-10", 1080, "USD", {
        target: "EUR",
        converted: 900,
      }),
    ],
    "EUR",
  );
  assertEq("paid (frozen converted)", r.shipment_allocations[0].paid_amount, 900);
  assertEq("outstanding", r.shipment_allocations[0].outstanding_amount, 100);
  assertEq("net_balance", r.net_balance, 100);
  assertEq("no skipped", r.skipped_events.length, 0);
}

section("7. Mixed currency without frozen FX -> skipped");
{
  const r = allocateFifo(
    [
      billing("b1", "2026-01-01", 1000, "EUR", "s1"),
      payment("p1", "2026-01-10", 1080, "USD"),
    ],
    "EUR",
  );
  assertEq("paid unaffected", r.shipment_allocations[0].paid_amount, 0);
  assertEq("outstanding unchanged", r.shipment_allocations[0].outstanding_amount, 1000);
  assertEq("one skipped", r.skipped_events.length, 1);
  assertEq("skipped is the payment", r.skipped_events[0].event.id, "p1");
  assertEq("net_balance", r.net_balance, 1000);
}

section("8. Refund with no unallocated credit -> reopens paid billing");
{
  const r = allocateFifo(
    [
      billing("b1", "2026-01-01", 1000, "EUR", "s1"),
      payment("p1", "2026-01-05", 1000, "EUR"),
      refund("r1", "2026-01-10", 200, "EUR"),
    ],
    "EUR",
  );
  assertEq("paid reduced", r.shipment_allocations[0].paid_amount, 800);
  assertEq("outstanding re-opened", r.shipment_allocations[0].outstanding_amount, 200);
  assertEq("fully_paid flipped", r.shipment_allocations[0].is_fully_paid, false);
  assertEq("net_balance", r.net_balance, 200);
}

section("9. Prepayment(s) arriving before billing -> retroactive FIFO match");
{
  const r = allocateFifo(
    [
      payment("p1", "2026-04-01", 6300, "USD"),
      payment("p2", "2026-04-22", 14700, "USD"),
      billing("b1", "2026-04-27", 21000, "USD", "s1"),
    ],
    "USD",
  );
  assertEq("billing paid in full", r.shipment_allocations[0].paid_amount, 21000);
  assertEq("outstanding zero", r.shipment_allocations[0].outstanding_amount, 0);
  assertEq("fully_paid", r.shipment_allocations[0].is_fully_paid, true);
  assertEq("unallocated_credit drained", r.unallocated_credit, 0);
  assertEq("net_balance settled", r.net_balance, 0);
  // Retroactive matches must still emit per-payment-per-shipment allocations
  // so the "Payments applied" table and PDF statement attribute the funding
  // back to the original prepayments.
  assertEq("two payment allocations recorded", r.payment_allocations.length, 2);
  assertEq("p1 allocated", r.payment_allocations[0].payment_event_id, "p1");
  assertEq("p1 amount", r.payment_allocations[0].allocated_amount, 6300);
  assertEq("p2 allocated", r.payment_allocations[1].payment_event_id, "p2");
  assertEq("p2 amount", r.payment_allocations[1].allocated_amount, 14700);
}

section("10. Prepayment exceeding billing -> remainder stays as credit");
{
  const r = allocateFifo(
    [
      payment("p1", "2026-04-01", 1000, "EUR"),
      billing("b1", "2026-04-27", 600, "EUR", "s1"),
    ],
    "EUR",
  );
  assertEq("billing paid up to its amount", r.shipment_allocations[0].paid_amount, 600);
  assertEq("excess stays as credit", r.unallocated_credit, 400);
  assertEq("net_balance shows we owe them", r.net_balance, -400);
}

section("11. Refund reopens the oldest paid billing first (FIFO unwind)");
{
  // Two billings, both fully paid by a single payment that overflows. A
  // refund larger than any unallocated credit must walk billings oldest-
  // first to mirror forward FIFO direction. Pre-fix the loop ran backward
  // and reopened b2 (newest) first, contradicting the allocator's name.
  const r = allocateFifo(
    [
      billing("b1", "2026-01-01", 600, "EUR", "s1"),
      billing("b2", "2026-02-01", 400, "EUR", "s2"),
      payment("p1", "2026-02-15", 1000, "EUR"),
      refund("r1", "2026-03-01", 300, "EUR"),
    ],
    "EUR",
  );
  assertEq("b1 reopened by 300", r.shipment_allocations[0].paid_amount, 300);
  assertEq("b1 outstanding 300", r.shipment_allocations[0].outstanding_amount, 300);
  assertEq("b2 untouched (still paid)", r.shipment_allocations[1].paid_amount, 400);
  assertEq("b2 outstanding 0", r.shipment_allocations[1].outstanding_amount, 0);
  assertEq("net_balance reflects refund", r.net_balance, 300);
}

section("12. Float residue from fractional payments still marks billing fully paid (EPS)");
{
  // 100 EUR billing covered by three 33.33 + 33.33 + 33.34 payments. Pre-fix,
  // strict `slot.paid >= slot.billed` left is_fully_paid = false because the
  // sum hits ~100.00000000000001 in IEEE-754 (or the inverse case lands ~1e-15
  // short). Mirrors partner-reimbursement-allocation test 8.
  const r = allocateFifo(
    [
      billing("b1", "2026-01-01", 100, "EUR", "s1"),
      payment("p1", "2026-01-02", 33.33, "EUR"),
      payment("p2", "2026-01-03", 33.33, "EUR"),
      payment("p3", "2026-01-04", 33.34, "EUR"),
    ],
    "EUR",
  );
  assertEq("billing reads as fully paid", r.shipment_allocations[0].is_fully_paid, true);
  assertEq("outstanding zeroed", r.shipment_allocations[0].outstanding_amount, 0);
  assertEq("no leaked unallocated credit", r.unallocated_credit, 0);
}

section(
  "13. USD refund against EUR-balance customer: frozen FX consumed symmetrically",
);
{
  // EUR-denominated customer. A USD payment of 1080 is captured at FX=0.83
  // -> stored fx_converted_amount = 900 EUR. Later, a USD refund of 240 is
  // captured at the SAME rate, freezing 200 EUR on the row. Pre-fix the
  // refund had no FX block, so its fx_converted_amount was null and
  // effectiveAmount returned null -> the refund was silently skipped from
  // the EUR ledger. Post-fix it must reopen 200 EUR of the paid billing.
  const r = allocateFifo(
    [
      billing("b1", "2026-01-01", 1000, "EUR", "s1"),
      payment("p1", "2026-01-10", 1080, "USD", {
        target: "EUR",
        converted: 900,
      }),
      refund("r1", "2026-01-20", 240, "USD", {
        target: "EUR",
        converted: 200,
      }),
    ],
    "EUR",
  );
  assertEq("paid reduced by frozen converted refund", r.shipment_allocations[0].paid_amount, 700);
  assertEq("outstanding re-opened to 300", r.shipment_allocations[0].outstanding_amount, 300);
  assertEq("net_balance reflects 1000 - (900 - 200)", r.net_balance, 300);
  assertEq("no skipped events when FX is frozen on every row", r.skipped_events.length, 0);
}

section(
  "14. USD refund against EUR-balance with NO FX block is skipped (regression guard)",
);
{
  // Pre-fix shape: the refund row never carried FX. The allocator must
  // refuse to silently consume it against the EUR ledger; instead it's
  // recorded in skipped_events with reason "no_fx" so the UI can surface
  // the broken row.
  const r = allocateFifo(
    [
      billing("b1", "2026-01-01", 1000, "EUR", "s1"),
      payment("p1", "2026-01-10", 1080, "USD", {
        target: "EUR",
        converted: 900,
      }),
      refund("r1", "2026-01-20", 240, "USD"),
    ],
    "EUR",
  );
  assertEq("paid untouched by no-FX refund", r.shipment_allocations[0].paid_amount, 900);
  assertEq("one skipped (the refund)", r.skipped_events.length, 1);
  assertEq("skipped is the refund", r.skipped_events[0].event.id, "r1");
  assertEq("skipped reason", r.skipped_events[0].reason, "no_fx");
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
