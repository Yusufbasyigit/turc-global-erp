import {
  aggregateMonthlyTotals,
  addTotals,
  emptyTotals,
} from "./queries";
import type { TransactionWithRelations } from "@/features/transactions/queries";
import type { FxSnapshot, MonthlyFxOverride } from "@/lib/supabase/types";

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

function section(label: string): void {
  console.log(`\n${label}`);
}

let nextId = 0;
function tx(opts: {
  date: string;
  kind: TransactionWithRelations["kind"];
  amount: number;
  currency: string;
  realEstateDealId?: string | null;
}): TransactionWithRelations {
  nextId += 1;
  return {
    id: `t${nextId}`,
    transaction_date: opts.date,
    kind: opts.kind,
    amount: opts.amount,
    currency: opts.currency,
    real_estate_deal_id: opts.realEstateDealId ?? null,
    description: null,
    contacts: null,
    partners: null,
    from_account: null,
    to_account: null,
    expense_types: null,
    related_payable: null,
  } as unknown as TransactionWithRelations;
}

function override(period: string, ratePerUsd: number): MonthlyFxOverride {
  return {
    period,
    currency_code: "TRY",
    rate_to_usd: ratePerUsd,
    note: null,
    set_at: "2026-04-28T00:00:00Z",
    set_by: null,
  } as unknown as MonthlyFxOverride;
}

function quarterlySum(
  months: string[],
  txs: TransactionWithRelations[],
  snaps: FxSnapshot[],
  overs: MonthlyFxOverride[],
) {
  let acc = emptyTotals();
  for (const m of months) {
    const agg = aggregateMonthlyTotals(m, txs, snaps, overs);
    acc = addTotals(acc, agg.totals);
  }
  return acc;
}

section(
  "1. Quarterly column equals sum of its 3 monthly columns to the cent (USD only)",
);
{
  const txs: TransactionWithRelations[] = [
    tx({ date: "2026-04-05", kind: "shipment_billing", amount: 10000, currency: "USD" }),
    tx({ date: "2026-05-12", kind: "shipment_billing", amount: 7500, currency: "USD" }),
    tx({ date: "2026-06-22", kind: "expense", amount: 1234.56, currency: "USD" }),
    tx({ date: "2026-06-30", kind: "shipment_cogs", amount: 800.4, currency: "USD" }),
    // out-of-quarter — should be ignored
    tx({ date: "2026-07-01", kind: "shipment_billing", amount: 999, currency: "USD" }),
  ];
  const months = ["2026-04", "2026-05", "2026-06"];
  const m4 = aggregateMonthlyTotals(months[0]!, txs, [], []).totals;
  const m5 = aggregateMonthlyTotals(months[1]!, txs, [], []).totals;
  const m6 = aggregateMonthlyTotals(months[2]!, txs, [], []).totals;
  const q = quarterlySum(months, txs, [], []);
  assertEq("Q2 revenue == sum of monthly revenue", q.revenueUsd, m4.revenueUsd + m5.revenueUsd + m6.revenueUsd);
  assertEq("Q2 expense == sum of monthly expense", q.expenseUsd, m4.expenseUsd + m5.expenseUsd + m6.expenseUsd);
  assertEq("Q2 net == sum of monthly net", q.netUsd, m4.netUsd + m5.netUsd + m6.netUsd);
  assertEq("Q2 net == 17500 - 2034.96", q.netUsd, 17500 - 2034.96);
  assertEq("July transaction excluded from Q2", q.revenueUsd, 17500);
}

section("2. Quarterly with TRY conversion uses each month's own rate");
{
  const txs: TransactionWithRelations[] = [
    tx({ date: "2026-04-05", kind: "shipment_billing", amount: 100000, currency: "TRY" }),
    tx({ date: "2026-05-05", kind: "shipment_billing", amount: 100000, currency: "TRY" }),
    tx({ date: "2026-06-05", kind: "expense", amount: 50000, currency: "TRY" }),
  ];
  const overs = [
    override("2026-04", 0.025),
    override("2026-05", 0.024),
    override("2026-06", 0.023),
  ];
  const months = ["2026-04", "2026-05", "2026-06"];
  const q = quarterlySum(months, txs, [], overs);
  // Revenue: 100000*0.025 + 100000*0.024 = 2500 + 2400 = 4900
  // Expense: 50000*0.023 = 1150
  assertEq("Q2 revenue uses per-month rates", q.revenueUsd, 4900);
  assertEq("Q2 expense uses June rate", q.expenseUsd, 1150);
  assertEq("Q2 net = 4900 - 1150", q.netUsd, 3750);
}

section("3. Annual column equals sum of its 12 monthly columns");
{
  const txs: TransactionWithRelations[] = [];
  for (let m = 1; m <= 12; m += 1) {
    const mm = m.toString().padStart(2, "0");
    txs.push(
      tx({ date: `2025-${mm}-15`, kind: "shipment_billing", amount: 1000, currency: "USD" }),
    );
    txs.push(
      tx({ date: `2025-${mm}-16`, kind: "expense", amount: 250, currency: "USD" }),
    );
  }
  const months = Array.from({ length: 12 }, (_, i) => `2025-${(i + 1).toString().padStart(2, "0")}`);
  let monthlySum = 0;
  for (const m of months) {
    monthlySum += aggregateMonthlyTotals(m, txs, [], []).totals.netUsd;
  }
  const y = quarterlySum(months, txs, [], []);
  assertEq("Year 2025 revenue == 12 * 1000", y.revenueUsd, 12000);
  assertEq("Year 2025 expense == 12 * 250", y.expenseUsd, 3000);
  assertEq("Year 2025 net == 12 * 750", y.netUsd, 9000);
  assertEq("Year sum equals month-by-month sum", y.netUsd, monthlySum);
}

section(
  "4. TRY rows in months with no rate are excluded from USD totals; hasMissingRate flagged",
);
{
  const txs: TransactionWithRelations[] = [
    tx({ date: "2026-04-05", kind: "shipment_billing", amount: 100000, currency: "TRY" }),
    tx({ date: "2026-04-10", kind: "shipment_billing", amount: 5000, currency: "USD" }),
  ];
  // No override for April, no snapshots -> rate missing
  const agg = aggregateMonthlyTotals("2026-04", txs, [], []);
  assertEq("USD revenue includes USD only", agg.totals.revenueUsd, 5000);
  assertEq("TRY revenue still counted in TRY", agg.totals.revenueTry, 100000);
  assertEq("hasMissingRate flag set", agg.hasMissingRate, true);
}

section("5. USD-only month with no rate is NOT flagged as missing");
{
  const txs: TransactionWithRelations[] = [
    tx({ date: "2026-04-05", kind: "shipment_billing", amount: 5000, currency: "USD" }),
  ];
  const agg = aggregateMonthlyTotals("2026-04", txs, [], []);
  assertEq("hasMissingRate is false", agg.hasMissingRate, false);
  assertEq("revenue counted", agg.totals.revenueUsd, 5000);
}

section("6. Real-estate vs export revenue split rolls up correctly");
{
  const txs: TransactionWithRelations[] = [
    tx({
      date: "2026-04-05",
      kind: "shipment_billing",
      amount: 8000,
      currency: "USD",
    }),
    tx({
      date: "2026-04-12",
      kind: "client_payment",
      amount: 3000,
      currency: "USD",
      realEstateDealId: "deal-1",
    }),
    tx({
      date: "2026-05-08",
      kind: "client_payment",
      amount: 2500,
      currency: "USD",
      realEstateDealId: "deal-1",
    }),
    tx({
      date: "2026-05-22",
      kind: "shipment_billing",
      amount: 6500,
      currency: "USD",
    }),
    tx({
      date: "2026-06-01",
      kind: "shipment_billing",
      amount: 4000,
      currency: "USD",
    }),
  ];
  const months = ["2026-04", "2026-05", "2026-06"];
  const q = quarterlySum(months, txs, [], []);
  assertEq("Export revenue Q2", q.revenueExportUsd, 8000 + 6500 + 4000);
  assertEq("Real-estate revenue Q2", q.revenueRealEstateUsd, 3000 + 2500);
  assertEq(
    "Total revenue == export + real-estate",
    q.revenueUsd,
    q.revenueExportUsd + q.revenueRealEstateUsd,
  );
}

section("7. supplier_invoice is NOT counted as expense (off-P&L liability)");
{
  const txs: TransactionWithRelations[] = [
    tx({ date: "2026-04-05", kind: "supplier_invoice", amount: 9999, currency: "USD" }),
  ];
  const agg = aggregateMonthlyTotals("2026-04", txs, [], []);
  assertEq("supplier_invoice ignored", agg.totals.expenseUsd, 0);
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
