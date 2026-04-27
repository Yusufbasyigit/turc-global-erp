import {
  allocatePartnerReimbursements,
  type PartnerReimbursementResult,
  type ReimbursementClaim,
  type ReimbursementPayout,
} from "@/lib/ledger/partner-reimbursement-allocation";
import type { PartnerTransactionRow } from "./partner-transactions";

export function extractClaimsAndPayouts(rows: PartnerTransactionRow[]): {
  claims: ReimbursementClaim[];
  payouts: ReimbursementPayout[];
} {
  const claims: ReimbursementClaim[] = [];
  const payouts: ReimbursementPayout[] = [];
  for (const r of rows) {
    if (r.kind === "expense" && r.partner_id && !r.from_account_id) {
      claims.push({
        id: r.id,
        date: r.transaction_date,
        amount: Number(r.amount),
        currency: r.currency,
        description: r.description ?? null,
      });
    } else if (r.kind === "partner_loan_out" && r.partner_id && !r.is_loan) {
      payouts.push({
        id: r.id,
        date: r.transaction_date,
        amount: Number(r.amount),
        currency: r.currency,
      });
    }
  }
  return { claims, payouts };
}

export function summarizePartnerReimbursements(
  rows: PartnerTransactionRow[],
): PartnerReimbursementResult {
  const { claims, payouts } = extractClaimsAndPayouts(rows);
  return allocatePartnerReimbursements(claims, payouts);
}
