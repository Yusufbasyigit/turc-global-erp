import { EPS } from "./eps";

export type ReimbursementClaim = {
  id: string;
  date: string;
  amount: number;
  currency: string;
  description: string | null;
};

export type ReimbursementPayout = {
  id: string;
  date: string;
  amount: number;
  currency: string;
};

export type ClaimAllocation = {
  claim_id: string;
  claim_date: string;
  claim_amount: number;
  claim_description: string | null;
  amount_settled: number;
  outstanding: number;
  is_fully_settled: boolean;
};

export type CurrencyBucket = {
  claim_allocations: ClaimAllocation[];
  total_claimed: number;
  total_paid: number;
  total_outstanding: number;
  unallocated_payout: number;
};

export type PartnerReimbursementResult = {
  by_currency: Record<string, CurrencyBucket>;
};

function sortByDateThenId<
  T extends { date: string; id: string },
>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    if (a.id !== b.id) return a.id < b.id ? -1 : 1;
    return 0;
  });
}

export function allocatePartnerReimbursements(
  claims: ReimbursementClaim[],
  payouts: ReimbursementPayout[],
): PartnerReimbursementResult {
  const currencies = new Set<string>();
  for (const c of claims) currencies.add(c.currency);
  for (const p of payouts) currencies.add(p.currency);

  const by_currency: Record<string, CurrencyBucket> = {};

  for (const currency of currencies) {
    const cClaims = sortByDateThenId(
      claims.filter((c) => c.currency === currency),
    );
    const cPayouts = sortByDateThenId(
      payouts.filter((p) => p.currency === currency),
    );

    const allocations: ClaimAllocation[] = cClaims.map((c) => ({
      claim_id: c.id,
      claim_date: c.date,
      claim_amount: c.amount,
      claim_description: c.description,
      amount_settled: 0,
      outstanding: c.amount,
      is_fully_settled: false,
    }));

    let unallocated = 0;
    for (const payout of cPayouts) {
      let remaining = payout.amount;
      for (const slot of allocations) {
        if (remaining <= EPS) break;
        if (slot.outstanding <= EPS) continue;
        const take = Math.min(slot.outstanding, remaining);
        slot.amount_settled += take;
        slot.outstanding -= take;
        remaining -= take;
      }
      if (remaining > EPS) unallocated += remaining;
    }

    for (const slot of allocations) {
      if (slot.outstanding <= EPS) {
        slot.outstanding = 0;
        slot.is_fully_settled = true;
      }
    }

    const total_claimed = cClaims.reduce((s, c) => s + c.amount, 0);
    const total_paid = cPayouts.reduce((s, p) => s + p.amount, 0);
    const total_outstanding = allocations.reduce(
      (s, a) => s + a.outstanding,
      0,
    );

    by_currency[currency] = {
      claim_allocations: allocations,
      total_claimed,
      total_paid,
      total_outstanding,
      unallocated_payout: unallocated,
    };
  }

  return { by_currency };
}
