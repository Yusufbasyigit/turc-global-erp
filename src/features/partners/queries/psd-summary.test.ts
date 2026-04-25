import { aggregatePsd, type PsdAggregateInput } from "./psd-summary";

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

function row(
  date: string,
  currency: string,
  amount: number,
): PsdAggregateInput {
  return { transaction_date: date, currency, amount };
}

function section(title: string): void {
  console.log(`\n${title}`);
}

section("1. Empty input yields empty output");
{
  const r = aggregatePsd([]);
  assertEq("length", r.length, 0);
}

section("2. Single row produces one bucket");
{
  const r = aggregatePsd([row("2026-04-15", "USD", 1000)]);
  assertEq("length", r.length, 1);
  assertEq("year", r[0].year, 2026);
  assertEq("month", r[0].month, 4);
  assertEq("currency", r[0].currency, "USD");
  assertEq("amount", r[0].amount, 1000);
}

section("3. Same month + currency accumulates");
{
  const r = aggregatePsd([
    row("2026-04-10", "USD", 500),
    row("2026-04-20", "USD", 300),
    row("2026-04-30", "USD", 200),
  ]);
  assertEq("one bucket", r.length, 1);
  assertEq("summed", r[0].amount, 1000);
}

section("4. Same month, different currencies are separate buckets");
{
  const r = aggregatePsd([
    row("2026-04-10", "USD", 500),
    row("2026-04-15", "EUR", 200),
    row("2026-04-20", "TRY", 10000),
  ]);
  assertEq("three buckets", r.length, 3);
  const byCcy = Object.fromEntries(r.map((b) => [b.currency, b.amount]));
  assertEq("USD", byCcy.USD, 500);
  assertEq("EUR", byCcy.EUR, 200);
  assertEq("TRY", byCcy.TRY, 10000);
}

section("5. Different months are separate buckets");
{
  const r = aggregatePsd([
    row("2026-01-10", "USD", 100),
    row("2026-02-10", "USD", 200),
    row("2026-03-10", "USD", 300),
  ]);
  assertEq("three buckets", r.length, 3);
  assertEq("jan", r[0].amount, 100);
  assertEq("feb", r[1].amount, 200);
  assertEq("mar", r[2].amount, 300);
}

section("6. Sorted by year, month, currency");
{
  const r = aggregatePsd([
    row("2025-12-10", "USD", 100),
    row("2026-01-10", "EUR", 200),
    row("2026-01-10", "USD", 300),
    row("2024-06-10", "TRY", 400),
  ]);
  assertEq("length", r.length, 4);
  assertEq("first is 2024-06-TRY", `${r[0].year}-${r[0].month}-${r[0].currency}`, "2024-6-TRY");
  assertEq("second is 2025-12-USD", `${r[1].year}-${r[1].month}-${r[1].currency}`, "2025-12-USD");
  assertEq("third is 2026-01-EUR", `${r[2].year}-${r[2].month}-${r[2].currency}`, "2026-1-EUR");
  assertEq("fourth is 2026-01-USD", `${r[3].year}-${r[3].month}-${r[3].currency}`, "2026-1-USD");
}

section("7. String amounts are coerced");
{
  const r = aggregatePsd([
    { transaction_date: "2026-04-10", currency: "USD", amount: "500" },
    { transaction_date: "2026-04-15", currency: "USD", amount: "250.50" },
  ]);
  assertEq("length", r.length, 1);
  assertEq("amount", r[0].amount, 750.5);
}

section("8. Multi-year, multi-currency, multi-month grouping");
{
  const r = aggregatePsd([
    row("2024-03-01", "USD", 100),
    row("2024-03-15", "USD", 200),
    row("2024-03-20", "EUR", 50),
    row("2025-06-05", "USD", 500),
    row("2026-01-10", "TRY", 10000),
    row("2026-01-15", "TRY", 5000),
  ]);
  assertEq("length", r.length, 4);
  const byKey: Record<string, number> = {};
  for (const b of r) {
    byKey[`${b.year}-${b.month}-${b.currency}`] = b.amount;
  }
  assertEq("2024-03-USD", byKey["2024-3-USD"], 300);
  assertEq("2024-03-EUR", byKey["2024-3-EUR"], 50);
  assertEq("2025-06-USD", byKey["2025-6-USD"], 500);
  assertEq("2026-01-TRY", byKey["2026-1-TRY"], 15000);
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
