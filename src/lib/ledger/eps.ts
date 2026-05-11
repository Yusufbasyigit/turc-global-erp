// Single source of truth for the ledger's numerical tolerance and the
// 2-decimal rounding rule applied to money fields at write boundaries.
//
// Policy:
//   - Money fields are rounded to 2 decimals at the write boundary
//     (`roundMoney`). Cents are the unit of record.
//   - EPS = 0.001 is the tolerance for "outstanding ≈ 0" comparisons in
//     the FIFO, partner-reimbursement, and installment allocators, and in
//     the supplier-invoice outstanding read path. A sub-cent residue
//     (typically ~1e-15 from float arithmetic, or ~0.5e-3 from an FX
//     round-trip) below EPS is treated as exact zero.
//
// Tolerance bigger than half a cent so that any residue formatCurrency
// would round away cannot keep `is_fully_paid = false`; smaller than one
// cent so that a genuine 1-cent shortfall still trips the "not fully
// paid" predicate.

export const EPS = 0.001;

export function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}
