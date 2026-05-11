import { roundMoney } from "./eps";

// Split a gross amount into net + VAT components, both rounded to 2 decimals
// at the write boundary. The invariant `net_amount + vat_amount === amount`
// (to the cent) is preserved by absorbing any sub-cent residue into
// `vat_amount`, so a 1000 TRY gross at 20% always stores 833.33 / 166.67 —
// never 166.66666666666669 — and the two halves always re-add to the
// original gross.
//
// Used by `transaction-form-dialog.tsx` for both `expense` and
// `supplier_invoice` payloads. Keeping a single helper means the KDV CSV
// detail rows (which echo what's in the DB) match the footer totals (which
// re-round on read).

export function splitVat(
  amount: number,
  vatRatePercent: number,
): { net_amount: number; vat_amount: number } {
  const gross = roundMoney(amount);
  const net = roundMoney(amount / (1 + vatRatePercent / 100));
  const vat = roundMoney(gross - net);
  return { net_amount: net, vat_amount: vat };
}
