// Pure helpers for the `orders.order_currency` lock guard.
//
// Mirrors the four other write-side guards documented in the 2026-05-08
// "Currency-defining fields are locked once child rows exist" entry:
// once a currency-tied child row exists (a priced order_details line, or a
// shipment_billing transaction on the order's billing shipment), the order's
// currency cannot be edited without first unwinding those rows.
//
// Extracted as a pure function so the message and gating logic are
// unit-testable without spinning up a supabase mock.

export type OrderCurrencyLockReason = {
  pricedLineCount: number;
  billingAccrualCount: number;
};

export type OrderCurrencyLockResult =
  | { ok: true }
  | { ok: false; reason: OrderCurrencyLockReason; message: string };

export function checkOrderCurrencyChange(input: {
  currentCurrency: string;
  nextCurrency: string;
  pricedLineCount: number;
  billingAccrualCount: number;
}): OrderCurrencyLockResult {
  if (input.currentCurrency === input.nextCurrency) {
    return { ok: true };
  }
  const reason: OrderCurrencyLockReason = {
    pricedLineCount: input.pricedLineCount,
    billingAccrualCount: input.billingAccrualCount,
  };
  if (reason.pricedLineCount === 0 && reason.billingAccrualCount === 0) {
    return { ok: true };
  }
  const parts: string[] = [];
  if (reason.pricedLineCount > 0) {
    const noun = reason.pricedLineCount === 1 ? "line" : "lines";
    parts.push(`${reason.pricedLineCount} priced ${noun}`);
  }
  if (reason.billingAccrualCount > 0) {
    const noun =
      reason.billingAccrualCount === 1 ? "accrual" : "accruals";
    parts.push(`${reason.billingAccrualCount} booked shipment_billing ${noun}`);
  }
  const cause = parts.join(" and ");
  const recovery =
    reason.billingAccrualCount > 0
      ? "Unbook the shipment, then clear or re-quote the lines in the original currency before retrying."
      : "Clear or re-quote the priced lines in the original currency before retrying.";
  return {
    ok: false,
    reason,
    message: `Cannot change order currency from ${input.currentCurrency} to ${input.nextCurrency}: ${cause} already exist(s) in the original currency. ${recovery}`,
  };
}
