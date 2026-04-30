import {
  computeCogsTotal,
  computeSalesTotal,
  planSnapshotRestore,
  type AccrualSnapshot,
  type ShipmentLineInput,
} from "./billing";

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

function line(
  qty: number,
  sales: number | null,
  actual: number | null = null,
  est: number | null = null,
): ShipmentLineInput {
  return {
    quantity: qty,
    unit_sales_price: sales,
    actual_purchase_price: actual,
    est_purchase_unit_price: est,
  };
}

section("0. Empty lines -> zero totals");
{
  assertEq("sales empty", computeSalesTotal([]), 0);
  assertEq("cogs empty", computeCogsTotal([]), 0);
}

section("1. Sales: qty * unit_sales_price summed across lines");
{
  const lines = [line(10, 5), line(3, 100), line(0.5, 200)];
  assertEq("sales total", computeSalesTotal(lines), 50 + 300 + 100);
}

section("2. Sales: nulls treated as zero");
{
  const lines = [line(10, null), line(5, 20)];
  assertEq("sales with nulls", computeSalesTotal(lines), 100);
}

section("3. Sales: numeric strings (Postgres returns numerics as strings)");
{
  const lines: ShipmentLineInput[] = [
    {
      quantity: "4" as unknown as number,
      unit_sales_price: "12.50" as unknown as number,
      actual_purchase_price: null,
      est_purchase_unit_price: null,
    },
  ];
  assertEq("sales string parsing", computeSalesTotal(lines), 50);
}

section("4. COGS: prefers actual_purchase_price when set");
{
  const lines = [line(10, 100, 60, 50)];
  assertEq("cogs uses actual", computeCogsTotal(lines), 600);
}

section("5. COGS: falls back to est when actual is null");
{
  const lines = [line(10, 100, null, 55)];
  assertEq("cogs falls back to est", computeCogsTotal(lines), 550);
}

section("6. COGS: zero when both actual and est are null");
{
  const lines = [line(10, 100, null, null)];
  assertEq("cogs zero with no cost", computeCogsTotal(lines), 0);
}

section("7. COGS: actual = 0 (explicit zero) is preferred over est");
{
  const lines = [line(10, 100, 0, 55)];
  assertEq("cogs uses actual zero", computeCogsTotal(lines), 0);
}

section("8. COGS: mixed lines sum correctly");
{
  const lines = [
    line(10, 100, 60, null),
    line(5, 200, null, 80),
    line(3, 50, null, null),
  ];
  // 10*60 + 5*80 + 3*0 = 600 + 400 + 0 = 1000
  assertEq("cogs mixed", computeCogsTotal(lines), 1000);
}

section("9. Net profit example end-to-end (matches plan verification case)");
{
  // One line: sales 100, est 60, actual 65, qty 1. Freight not in COGS.
  const lines = [line(1, 100, 65, 60)];
  const sales = computeSalesTotal(lines);
  const cogs = computeCogsTotal(lines);
  // Freight is computed elsewhere from shipments.freight_cost.
  const freight = 10;
  const net = sales - cogs - freight;
  assertEq("sales", sales, 100);
  assertEq("cogs (actual)", cogs, 65);
  assertEq("net profit", net, 25);
}

function snap(
  overrides: Partial<AccrualSnapshot> = {},
): AccrualSnapshot {
  return {
    kind: "shipment_billing",
    transactionId: null,
    previousAmount: null,
    previousEdited: { edited_by: null, edited_time: null },
    ...overrides,
  };
}

section("10. planSnapshotRestore: no row before, none created → noop");
{
  const action = planSnapshotRestore(
    snap({ transactionId: null, previousAmount: null }),
  );
  assertEq("noop on missing row", action.type, "noop");
}

section("11. planSnapshotRestore: row pre-existed → update back to prior amount");
{
  const action = planSnapshotRestore(
    snap({
      transactionId: "txn-1",
      previousAmount: 100,
      previousEdited: { edited_by: "user-x", edited_time: "2026-04-30T00:00:00Z" },
    }),
  );
  assertEq("update type", action.type, "update");
  if (action.type === "update") {
    assertEq("update id", action.id, "txn-1");
    assertEq("update amount", action.amount, 100);
    assertEq("update edited_by", action.edited.edited_by, "user-x");
  }
}

section("12. planSnapshotRestore: row newly created in transition → delete");
{
  // After upsertAccrual creates a row, refreshAccrualsForShipmentTransition
  // writes the new id back into the snapshot while keeping previousAmount=null.
  // Rolling back must DELETE it (the original bug: this case was a noop).
  const action = planSnapshotRestore(
    snap({ transactionId: "txn-new", previousAmount: null }),
  );
  assertEq("delete type", action.type, "delete");
  if (action.type === "delete") {
    assertEq("delete id", action.id, "txn-new");
  }
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
