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
    kind: "client_payment",
    amount,
    currency,
    related_shipment_id: null,
    fx_converted_amount: fx?.converted ?? null,
    fx_target_currency: fx?.target ?? null,
  };
}

function refund(id: string, date: string, amount: number, currency: string): LedgerEvent {
  return {
    id,
    date,
    kind: "client_refund",
    amount,
    currency,
    related_shipment_id: null,
    fx_converted_amount: null,
    fx_target_currency: null,
  };
}

function adjustment(
  id: string,
  date: string,
  amount: number,
  currency: string,
  shipmentId?: string,
): LedgerEvent {
  return {
    id,
    date,
    kind: "adjustment",
    amount,
    currency,
    related_shipment_id: shipmentId ?? null,
    fx_converted_amount: null,
    fx_target_currency: null,
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

section("9. Adjustments surfaced but not FIFO-allocated");
{
  const r = allocateFifo(
    [
      billing("b1", "2026-01-01", 1000, "EUR", "s1"),
      adjustment("a1", "2026-01-02", 50, "EUR"),
      payment("p1", "2026-01-05", 1000, "EUR"),
    ],
    "EUR",
  );
  assertEq("standalone adjustment present", r.standalone_adjustments.length, 1);
  assertEq("adjustment id", r.standalone_adjustments[0].id, "a1");
  assertEq("paid not affected by adjustment", r.shipment_allocations[0].paid_amount, 1000);
  assertEq("net_balance ignores adjustment", r.net_balance, 0);
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
