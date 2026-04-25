import { createClient } from "@/lib/supabase/client";
import type { Partner } from "@/lib/supabase/types";

export const partnerKeys = {
  all: ["partners"] as const,
  list: () => [...partnerKeys.all, "list"] as const,
  detail: (id: string) => [...partnerKeys.all, "detail", id] as const,
};

export type PartnerWithStats = Partner & {
  transaction_count: number;
  last_activity: string | null;
};

export async function listPartnersWithStats(): Promise<PartnerWithStats[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("partners")
    .select("*, transactions(id, transaction_date)");

  if (error) throw error;

  const rows = (data ?? []) as (Partner & {
    transactions: { id: string; transaction_date: string }[] | null;
  })[];

  return rows.map((p) => {
    const txns = p.transactions ?? [];
    const last = txns.reduce<string | null>(
      (acc, t) =>
        acc === null || t.transaction_date > acc ? t.transaction_date : acc,
      null,
    );
    const { transactions: _t, ...rest } = p;
    return {
      ...rest,
      transaction_count: txns.length,
      last_activity: last,
    };
  });
}

export async function getPartner(id: string): Promise<Partner | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("partners")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data ?? null;
}
