import { rowsToCsv, buildKdvCsv } from "./csv";
import type { KdvRow } from "./queries";

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

function row(opts: Partial<KdvRow>): KdvRow {
  return {
    id: "t1",
    transaction_date: "2026-04-15",
    kind: "expense",
    currency: "TRY",
    vat_amount: 100,
    kdv_period: null,
    reference_number: null,
    amount: 600,
    net_amount: 500,
    vat_rate: 20,
    description: null,
    contact_name: null,
    partner_name: null,
    ...opts,
  };
}

section("1. rowsToCsv: basic header + body separated by CRLF");
{
  const csv = rowsToCsv(["a", "b"], [["1", "2"]]);
  assertEq("expected", csv, "a,b\r\n1,2");
}

section("2. rowsToCsv: cells with commas are quoted");
{
  const csv = rowsToCsv(["a", "b"], [["x,y", "z"]]);
  assertEq("comma quoted", csv, 'a,b\r\n"x,y",z');
}

section("3. rowsToCsv: cells with double-quotes get internal doubling");
{
  const csv = rowsToCsv(["a"], [['he said "hi"']]);
  assertEq("escaped", csv, 'a\r\n"he said ""hi"""');
}

section("4. rowsToCsv: cells with newlines are quoted");
{
  const csv = rowsToCsv(["a"], [["line1\nline2"]]);
  assertEq("newline quoted", csv, 'a\r\n"line1\nline2"');
}

section("5. rowsToCsv: null/undefined cells become empty string");
{
  const csv = rowsToCsv(["a", "b"], [[null, "x"]]);
  assertEq("null", csv, "a,b\r\n,x");
}

section("6. rowsToCsv: number cells stringified");
{
  const csv = rowsToCsv(["a"], [[42]]);
  assertEq("number", csv, "a\r\n42");
}

section("7. buildKdvCsv: filters to period and VAT-bearing kinds only");
{
  const rows: KdvRow[] = [
    row({ id: "1", transaction_date: "2026-04-15", kind: "expense" }),
    row({ id: "2", transaction_date: "2026-04-20", kind: "shipment_billing" }),
    row({ id: "3", transaction_date: "2026-03-15", kind: "expense" }), // wrong month
    row({ id: "4", transaction_date: "2026-04-15", kind: "tax_payment" }), // not VAT-bearing
  ];
  const result = buildKdvCsv(rows, "2026-04");
  assertEq("tryCount", result.tryCount, 2);
  assertEq("skippedCount", result.skippedCount, 0);
  // CSV body must have header + note + 2 data rows.
  const lines = result.csv.split("\r\n");
  assertEq("4 lines", lines.length, 4);
}

section("8. buildKdvCsv: non-TRY rows in window go to skipped, not exported");
{
  const rows: KdvRow[] = [
    row({ id: "1", transaction_date: "2026-04-15", kind: "expense", currency: "TRY" }),
    row({ id: "2", transaction_date: "2026-04-20", kind: "expense", currency: "EUR" }),
    row({ id: "3", transaction_date: "2026-04-25", kind: "expense", currency: "USD" }),
  ];
  const result = buildKdvCsv(rows, "2026-04");
  assertEq("tryCount", result.tryCount, 1);
  assertEq("skippedCount", result.skippedCount, 2);
}

section("9. buildKdvCsv: vat_amount=null is treated as skipped");
{
  const rows: KdvRow[] = [
    row({ id: "1", transaction_date: "2026-04-15", kind: "expense", vat_amount: null }),
    row({ id: "2", transaction_date: "2026-04-15", kind: "expense", vat_amount: 100 }),
  ];
  const result = buildKdvCsv(rows, "2026-04");
  assertEq("tryCount", result.tryCount, 1);
  assertEq("skippedCount", result.skippedCount, 1);
}

section("10. buildKdvCsv: header line is the period note");
{
  const result = buildKdvCsv([], "2026-04");
  const firstLine = result.csv.split("\r\n")[1] ?? "";
  assertEq("note has period", firstLine.includes("KDV 2026-04"), true);
  assertEq("note has zero skipped", firstLine.includes("0"), true);
}

section("11. buildKdvCsv: contact_name preferred over partner_name");
{
  const rows: KdvRow[] = [
    row({
      id: "1",
      transaction_date: "2026-04-15",
      kind: "expense",
      contact_name: "Acme Co",
      partner_name: "John",
    }),
  ];
  const csv = buildKdvCsv(rows, "2026-04").csv;
  assertEq("contact wins", csv.includes("Acme Co"), true);
  assertEq("partner skipped", csv.includes("John"), false);
}

section("12. buildKdvCsv: falls back to partner_name when contact_name null");
{
  const rows: KdvRow[] = [
    row({
      id: "1",
      transaction_date: "2026-04-15",
      kind: "expense",
      contact_name: null,
      partner_name: "Yusuf",
    }),
  ];
  const csv = buildKdvCsv(rows, "2026-04").csv;
  assertEq("partner used", csv.includes("Yusuf"), true);
}

section("13. buildKdvCsv: empty input -> note + header only, zero rows");
{
  const result = buildKdvCsv([], "2026-04");
  assertEq("tryCount 0", result.tryCount, 0);
  assertEq("skippedCount 0", result.skippedCount, 0);
  // Lines: header + note + 0 body rows = 2.
  assertEq("2 lines", result.csv.split("\r\n").length, 2);
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
