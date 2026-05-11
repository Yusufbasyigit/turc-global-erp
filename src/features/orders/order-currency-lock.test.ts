import { checkOrderCurrencyChange } from "./order-currency-lock";

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

section("1. Same-currency edit is always allowed");
{
  const r = checkOrderCurrencyChange({
    currentCurrency: "USD",
    nextCurrency: "USD",
    pricedLineCount: 5,
    billingAccrualCount: 1,
  });
  assertEq("ok", r.ok, true);
}

section("2. Change is allowed when no priced lines and no accrual exist");
{
  // The whole point of the lock is to protect *existing* currency-tied data.
  // An order still in inquiry with no priced lines must be editable.
  const r = checkOrderCurrencyChange({
    currentCurrency: "USD",
    nextCurrency: "EUR",
    pricedLineCount: 0,
    billingAccrualCount: 0,
  });
  assertEq("ok", r.ok, true);
}

section("3. Change is blocked when priced lines exist");
{
  const r = checkOrderCurrencyChange({
    currentCurrency: "USD",
    nextCurrency: "EUR",
    pricedLineCount: 3,
    billingAccrualCount: 0,
  });
  assertEq("not ok", r.ok, false);
  if (!r.ok) {
    assertEq("names line count", r.message.includes("3 priced lines"), true);
    assertEq("names old currency", r.message.includes("USD"), true);
    assertEq("names new currency", r.message.includes("EUR"), true);
    assertEq(
      "recovery mentions re-quote",
      /re-quote|clear/i.test(r.message),
      true,
    );
  }
}

section("4. Singular noun for one priced line");
{
  const r = checkOrderCurrencyChange({
    currentCurrency: "USD",
    nextCurrency: "EUR",
    pricedLineCount: 1,
    billingAccrualCount: 0,
  });
  if (!r.ok) {
    assertEq("singular 'line'", r.message.includes("1 priced line"), true);
    assertEq(
      "no plural slip",
      r.message.includes("1 priced lines"),
      false,
    );
  }
}

section("5. Change is blocked when shipment_billing accrual exists");
{
  const r = checkOrderCurrencyChange({
    currentCurrency: "USD",
    nextCurrency: "TRY",
    pricedLineCount: 0,
    billingAccrualCount: 1,
  });
  assertEq("not ok", r.ok, false);
  if (!r.ok) {
    assertEq(
      "names accrual",
      r.message.includes("1 booked shipment_billing accrual"),
      true,
    );
    assertEq(
      "recovery mentions unbook",
      /unbook/i.test(r.message),
      true,
    );
  }
}

section("6. Both reasons listed when both apply");
{
  const r = checkOrderCurrencyChange({
    currentCurrency: "EUR",
    nextCurrency: "GBP",
    pricedLineCount: 2,
    billingAccrualCount: 1,
  });
  if (!r.ok) {
    assertEq("lines part", r.message.includes("2 priced lines"), true);
    assertEq(
      "accrual part",
      r.message.includes("1 booked shipment_billing accrual"),
      true,
    );
    // Booked-shipment recovery wins because it's the harder unwind.
    assertEq("recovery favours unbook", /unbook/i.test(r.message), true);
  }
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
