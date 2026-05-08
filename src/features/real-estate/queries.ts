"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { todayDateString } from "@/features/treasury/fx-utils";
import {
  allocateRealEstateInstallments,
  type DealAllocationResult,
} from "@/lib/ledger/installment-allocation";
import type {
  Contact,
  RealEstateDeal,
  RealEstateInstallment,
  Transaction,
} from "@/lib/supabase/types";

export type DealReceiptRow = Pick<
  Transaction,
  "id" | "transaction_date" | "amount" | "currency" | "to_account_id" | "description"
>;

export type DealWithRelations = RealEstateDeal & {
  contact: Pick<Contact, "id" | "company_name"> | null;
  installments: RealEstateInstallment[];
  receipts: DealReceiptRow[];
};

export type DealState = DealWithRelations & {
  allocation: DealAllocationResult;
};

export const realEstateKeys = {
  all: ["real-estate"] as const,
  deals: () => [...realEstateKeys.all, "deals"] as const,
  detail: (id: string) => [...realEstateKeys.all, "deal", id] as const,
  byContact: (contactId: string) =>
    [...realEstateKeys.all, "by-contact", contactId] as const,
};

const DEAL_SELECT = `
  id, label, sub_type, contact_id, currency, start_date, notes,
  deleted_at, created_time, edited_time, created_by, edited_by,
  contact:contacts!real_estate_deals_contact_id_fkey(id, company_name),
  installments:real_estate_installments(*)
`;

async function attachReceipts(
  deals: Omit<DealWithRelations, "receipts">[],
): Promise<DealWithRelations[]> {
  if (deals.length === 0) return [];
  const supabase = createClient();
  const dealIds = deals.map((d) => d.id);
  const { data: rxData, error: rxErr } = await supabase
    .from("transactions")
    .select(
      "id, transaction_date, amount, currency, to_account_id, description, real_estate_deal_id",
    )
    .in("real_estate_deal_id", dealIds);
  if (rxErr) throw rxErr;

  const byDeal = new Map<string, DealReceiptRow[]>();
  for (const r of (rxData ?? []) as Array<
    DealReceiptRow & { real_estate_deal_id: string }
  >) {
    const list = byDeal.get(r.real_estate_deal_id) ?? [];
    list.push({
      id: r.id,
      transaction_date: r.transaction_date,
      amount: r.amount,
      currency: r.currency,
      to_account_id: r.to_account_id,
      description: r.description,
    });
    byDeal.set(r.real_estate_deal_id, list);
  }

  return deals.map((d) => ({
    ...d,
    receipts: byDeal.get(d.id) ?? [],
  }));
}

export async function listDealsWithRelations(): Promise<DealWithRelations[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("real_estate_deals")
    .select(DEAL_SELECT)
    .is("deleted_at", null)
    .order("start_date", { ascending: false })
    .order("id", { ascending: false });
  if (error) throw error;

  type DealRow = Omit<DealWithRelations, "receipts">;
  return attachReceipts((data ?? []) as unknown as DealRow[]);
}

export async function listDealsForContact(
  contactId: string,
): Promise<DealWithRelations[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("real_estate_deals")
    .select(DEAL_SELECT)
    .eq("contact_id", contactId)
    .is("deleted_at", null)
    .order("start_date", { ascending: false })
    .order("id", { ascending: false });
  if (error) throw error;

  type DealRow = Omit<DealWithRelations, "receipts">;
  return attachReceipts((data ?? []) as unknown as DealRow[]);
}

export function computeDealStates(deals: DealWithRelations[]): DealState[] {
  const today = todayDateString();
  return deals.map((d) => {
    const allocation = allocateRealEstateInstallments(
      d.installments.map((i) => ({
        id: i.id,
        due_date: i.due_date,
        expected_amount: Number(i.expected_amount),
        sequence: i.sequence,
      })),
      d.receipts.map((r) => ({
        id: r.id,
        date: r.transaction_date,
        amount: Number(r.amount),
      })),
      today,
    );
    return { ...d, allocation };
  });
}

export function useDealStates() {
  const q = useQuery({
    queryKey: realEstateKeys.deals(),
    queryFn: listDealsWithRelations,
  });
  const data = useMemo(
    () => (q.data ? computeDealStates(q.data) : null),
    [q.data],
  );
  return { ...q, data };
}

export function useDealStatesForContact(contactId: string) {
  const q = useQuery({
    queryKey: realEstateKeys.byContact(contactId),
    queryFn: () => listDealsForContact(contactId),
    enabled: Boolean(contactId),
  });
  const data = useMemo(
    () => (q.data ? computeDealStates(q.data) : null),
    [q.data],
  );
  return { ...q, data };
}

export type OverdueInstallmentRow = {
  deal_id: string;
  deal_label: string;
  contact_name: string | null;
  installment_id: string;
  due_date: string;
  outstanding: number;
  currency: string;
  days_overdue: number;
};

export function useOverdueInstallments(thresholdDays: number = 7) {
  const { data } = useDealStates();
  return useMemo<OverdueInstallmentRow[]>(() => {
    if (!data) return [];
    const today = todayDateString();
    const out: OverdueInstallmentRow[] = [];
    for (const d of data) {
      for (const inst of d.allocation.installments) {
        if (inst.outstanding <= 0.001) continue;
        if (inst.due_date >= today) continue;
        const daysOverdue = daysBetween(inst.due_date, today);
        if (daysOverdue <= thresholdDays) continue;
        out.push({
          deal_id: d.id,
          deal_label: d.label,
          contact_name: d.contact?.company_name ?? null,
          installment_id: inst.installment_id,
          due_date: inst.due_date,
          outstanding: inst.outstanding,
          currency: d.currency,
          days_overdue: daysOverdue,
        });
      }
    }
    out.sort((a, b) => (a.due_date < b.due_date ? -1 : 1));
    return out;
  }, [data, thresholdDays]);
}

export function daysBetween(fromIso: string, toIso: string): number {
  const a = Date.parse(fromIso);
  const b = Date.parse(toIso);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.floor((b - a) / 86_400_000);
}
