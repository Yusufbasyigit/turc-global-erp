// Pure FIFO allocator for real-estate deal installments. Walks receipts
// oldest-first and consumes installments oldest-first within a single deal
// (and a single currency, since every deal is single-currency by design).
//
// Mirrors the contract of `partner-reimbursement-allocation.ts` so behavior
// is consistent across the app's installment-style ledgers.

export type RealEstateInstallmentInput = {
  id: string;
  due_date: string;
  expected_amount: number;
  sequence: number;
};

export type RealEstateReceiptInput = {
  id: string;
  date: string;
  amount: number;
};

export type InstallmentStatus = "paid" | "partial" | "due" | "overdue";

export type InstallmentState = {
  installment_id: string;
  due_date: string;
  expected_amount: number;
  sequence: number;
  paid: number;
  outstanding: number;
  status: InstallmentStatus;
};

export type DealAllocationResult = {
  installments: InstallmentState[];
  total_expected: number;
  total_paid: number;
  total_outstanding: number;
  unallocated_payment: number;
};

const EPS = 0.001;

function sortByDateThenId<T extends { date?: string; due_date?: string; id: string }>(
  rows: T[],
  dateKey: "date" | "due_date",
): T[] {
  return [...rows].sort((a, b) => {
    const ad = (a as Record<string, unknown>)[dateKey] as string;
    const bd = (b as Record<string, unknown>)[dateKey] as string;
    if (ad !== bd) return ad < bd ? -1 : 1;
    return a.id < b.id ? -1 : 1;
  });
}

export function allocateRealEstateInstallments(
  installments: RealEstateInstallmentInput[],
  receipts: RealEstateReceiptInput[],
  today: string,
): DealAllocationResult {
  const sortedInst = [...installments].sort((a, b) => {
    if (a.due_date !== b.due_date) return a.due_date < b.due_date ? -1 : 1;
    if (a.sequence !== b.sequence) return a.sequence - b.sequence;
    return a.id < b.id ? -1 : 1;
  });
  const sortedReceipts = sortByDateThenId(receipts, "date");

  const states: InstallmentState[] = sortedInst.map((i) => ({
    installment_id: i.id,
    due_date: i.due_date,
    expected_amount: i.expected_amount,
    sequence: i.sequence,
    paid: 0,
    outstanding: i.expected_amount,
    status: "due",
  }));

  let unallocated = 0;
  for (const r of sortedReceipts) {
    let remaining = r.amount;
    for (const slot of states) {
      if (remaining <= EPS) break;
      if (slot.outstanding <= EPS) continue;
      const take = Math.min(slot.outstanding, remaining);
      slot.paid += take;
      slot.outstanding -= take;
      remaining -= take;
    }
    if (remaining > EPS) unallocated += remaining;
  }

  for (const slot of states) {
    if (slot.outstanding <= EPS) {
      slot.status = "paid";
      slot.outstanding = 0;
    } else if (slot.due_date < today) {
      // Overdue takes priority over "partial" so a part-paid installment that
      // is also past due renders red (delinquent) rather than amber (just
      // making progress). Without this, the per-installment row in the deal
      // drawer would hide the late-payment signal.
      slot.status = "overdue";
    } else if (slot.paid > EPS) {
      slot.status = "partial";
    } else {
      slot.status = "due";
    }
  }

  const total_expected = states.reduce((s, x) => s + x.expected_amount, 0);
  const total_paid = states.reduce((s, x) => s + x.paid, 0);
  const total_outstanding = states.reduce((s, x) => s + x.outstanding, 0);

  return {
    installments: states,
    total_expected,
    total_paid,
    total_outstanding,
    unallocated_payment: unallocated,
  };
}
