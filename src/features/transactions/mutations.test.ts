import { reconcileFxConvertedAmount } from "./mutations";
import type { TransactionUpdate } from "@/lib/supabase/types";

let passed = 0;
let failed = 0;

function approx(a: number | null | undefined, b: number | null): boolean {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  return Math.abs(a - b) < 0.001;
}

function assertEq<T>(label: string, actual: T, expected: T): void {
  const isNum =
    (typeof actual === "number" || actual == null) &&
    (typeof expected === "number" || expected == null);
  const ok = isNum
    ? approx(actual as number | null, expected as number | null)
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

const baseRow = {
  amount: 1000,
  currency: "USD",
  fx_rate_applied: 0.92,
  fx_target_currency: "EUR",
};

section(
  "1. Editing amount alone recomputes fx_converted_amount from existing rate",
);
{
  // Pre-fix: a user editing 1000 -> 1100 leaves fx_converted_amount = 920
  // stored on the row, even though the correct value is 1012. FIFO trusts
  // the stale 920. Post-fix the helper recomputes from the resulting state.
  const payload = { amount: 1100 } satisfies TransactionUpdate;
  const out = reconcileFxConvertedAmount(baseRow, payload);
  assertEq("fx_converted_amount = 1100 * 0.92", out.fx_converted_amount, 1012);
  assertEq("amount preserved", out.amount, 1100);
}

section("2. Editing fx_rate_applied alone recomputes converted amount");
{
  const payload = { fx_rate_applied: 0.95 } satisfies TransactionUpdate;
  const out = reconcileFxConvertedAmount(baseRow, payload);
  assertEq("fx_converted_amount = 1000 * 0.95", out.fx_converted_amount, 950);
}

section("3. Editing both amount and rate uses both new values");
{
  const payload = {
    amount: 2000,
    fx_rate_applied: 0.9,
  } satisfies TransactionUpdate;
  const out = reconcileFxConvertedAmount(baseRow, payload);
  assertEq("fx_converted_amount = 2000 * 0.9", out.fx_converted_amount, 1800);
}

section("4. Clearing fx_rate_applied voids the converted amount");
{
  const payload = { fx_rate_applied: null } satisfies TransactionUpdate;
  const out = reconcileFxConvertedAmount(baseRow, payload);
  assertEq("fx_converted_amount = null", out.fx_converted_amount, null);
}

section("5. Clearing fx_target_currency voids the converted amount");
{
  const payload = { fx_target_currency: null } satisfies TransactionUpdate;
  const out = reconcileFxConvertedAmount(baseRow, payload);
  assertEq("fx_converted_amount = null", out.fx_converted_amount, null);
}

section(
  "6. Payload with no FX-relevant fields is passed through unchanged",
);
{
  // Editing description or another off-FX field must not recompute. The
  // helper short-circuits and leaves the existing fx_converted_amount
  // untouched so we don't overwrite a value the caller didn't ask to change.
  const payload = { description: "note" } satisfies TransactionUpdate;
  const out = reconcileFxConvertedAmount(baseRow, payload);
  assertEq(
    "no fx_converted_amount key emitted",
    "fx_converted_amount" in out,
    false,
  );
  assertEq("description preserved", out.description, "note");
}

section(
  "7. Existing row has no FX (USD->USD payment): editing amount keeps converted null",
);
{
  const existing = {
    amount: 500,
    currency: "USD",
    fx_rate_applied: null,
    fx_target_currency: null,
  };
  const payload = { amount: 600 } satisfies TransactionUpdate;
  const out = reconcileFxConvertedAmount(existing, payload);
  assertEq(
    "fx_converted_amount stays null when no rate exists",
    out.fx_converted_amount,
    null,
  );
}

section(
  "8. Setting all three FX fields at once produces the matching converted amount",
);
{
  // A USD->EUR conversion freshly added: previously no FX, now rate=0.91
  // and target=EUR with amount=1000. Helper must compute 910.
  const existing = {
    amount: 1000,
    currency: "USD",
    fx_rate_applied: null,
    fx_target_currency: null,
  };
  const payload = {
    amount: 1000,
    fx_rate_applied: 0.91,
    fx_target_currency: "EUR",
  } satisfies TransactionUpdate;
  const out = reconcileFxConvertedAmount(existing, payload);
  assertEq("fx_converted_amount = 910", out.fx_converted_amount, 910);
}

section(
  "9. Zero / negative amount voids the converted amount even with a rate",
);
{
  const payload = { amount: 0 } satisfies TransactionUpdate;
  const out = reconcileFxConvertedAmount(baseRow, payload);
  assertEq(
    "fx_converted_amount = null for non-positive amount",
    out.fx_converted_amount,
    null,
  );
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
