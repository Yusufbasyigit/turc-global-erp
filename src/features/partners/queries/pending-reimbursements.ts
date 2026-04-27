import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import {
  allocatePartnerReimbursements,
  type ReimbursementClaim,
  type ReimbursementPayout,
} from "@/lib/ledger/partner-reimbursement-allocation";
import type { Partner } from "@/lib/supabase/types";

export type PartnerPendingCurrency = {
  currency: string;
  amount: number;
  claim_count: number;
  // The oldest open claim's date and outstanding amount, populated when
  // claim_count > 0. The dashboard's "old reimbursement" attention rule
  // reads these instead of refetching the same per-claim allocations.
  oldest_open_claim_date: string | null;
  oldest_open_claim_amount: number;
};

export type PartnerPendingSummary = {
  partner: Pick<Partner, "id" | "name">;
  pending: PartnerPendingCurrency[];
};

export type ClaimOrPayoutRow = {
  id: string;
  kind: string;
  partner_id: string | null;
  from_account_id: string | null;
  transaction_date: string;
  amount: number | string;
  currency: string;
  description: string | null;
  is_loan: boolean;
};

export function buildPendingSummary(
  partners: Pick<Partner, "id" | "name">[],
  rows: ClaimOrPayoutRow[],
): PartnerPendingSummary[] {
  const byPartner = new Map<string, ClaimOrPayoutRow[]>();
  for (const r of rows) {
    if (!r.partner_id) continue;
    const list = byPartner.get(r.partner_id) ?? [];
    list.push(r);
    byPartner.set(r.partner_id, list);
  }

  const results: PartnerPendingSummary[] = [];
  for (const partner of partners) {
    const partnerRows = byPartner.get(partner.id) ?? [];
    const claims: ReimbursementClaim[] = [];
    const payouts: ReimbursementPayout[] = [];
    for (const r of partnerRows) {
      if (r.kind === "expense" && !r.from_account_id) {
        claims.push({
          id: r.id,
          date: r.transaction_date,
          amount: Number(r.amount),
          currency: r.currency,
          description: r.description,
        });
      } else if (r.kind === "partner_loan_out" && !r.is_loan) {
        payouts.push({
          id: r.id,
          date: r.transaction_date,
          amount: Number(r.amount),
          currency: r.currency,
        });
      }
    }
    const result = allocatePartnerReimbursements(claims, payouts);
    const pending: PartnerPendingCurrency[] = [];
    for (const currency of Object.keys(result.by_currency).sort()) {
      const bucket = result.by_currency[currency];
      if (bucket.total_outstanding <= 0.001) continue;
      const open = bucket.claim_allocations.filter(
        (a) => a.outstanding > 0.001,
      );
      // Bucket's claim_allocations are already sorted by date asc, id asc
      // by allocatePartnerReimbursements; the first open claim is the oldest.
      const oldest = open[0] ?? null;
      pending.push({
        currency,
        amount: bucket.total_outstanding,
        claim_count: open.length,
        oldest_open_claim_date: oldest?.claim_date ?? null,
        oldest_open_claim_amount: oldest?.outstanding ?? 0,
      });
    }
    if (pending.length > 0) {
      results.push({ partner, pending });
    }
  }
  return results;
}

export async function listPartnersWithPendingReimbursements(): Promise<
  PartnerPendingSummary[]
> {
  const supabase = createClient();

  const { data: partners, error: pErr } = await supabase
    .from("partners")
    .select("id, name")
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("name", { ascending: true });
  if (pErr) throw pErr;
  const activePartners = (partners ?? []) as Pick<Partner, "id" | "name">[];
  if (activePartners.length === 0) return [];

  const activeIds = activePartners.map((p) => p.id);

  const { data: rows, error: tErr } = await supabase
    .from("transactions")
    .select(
      "id, kind, partner_id, from_account_id, transaction_date, amount, currency, description, is_loan",
    )
    .in("partner_id", activeIds)
    .in("kind", ["expense", "partner_loan_out"]);
  if (tErr) throw tErr;

  return buildPendingSummary(activePartners, (rows ?? []) as ClaimOrPayoutRow[]);
}

export const pendingReimbursementsKeys = {
  all: ["partner-pending-reimbursements"] as const,
  list: () => [...pendingReimbursementsKeys.all, "list"] as const,
};

export function usePartnersWithPendingReimbursements() {
  return useQuery({
    queryKey: pendingReimbursementsKeys.list(),
    queryFn: listPartnersWithPendingReimbursements,
  });
}
