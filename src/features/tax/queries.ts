import { createClient } from "@/lib/supabase/client";
import {
  istanbulYearMonth,
  shiftYearMonth,
} from "@/lib/proforma/istanbul-date";
import type { KdvInputTxn } from "@/lib/ledger/kdv-summary";
import {
  VAT_COLLECTED_KINDS,
  VAT_PAID_KINDS,
} from "@/lib/ledger/kdv-summary";
import type { TransactionKind } from "@/lib/supabase/types";

export const kdvKeys = {
  all: ["kdv"] as const,
  window: (monthsBack: number) =>
    [...kdvKeys.all, "window", monthsBack] as const,
};

export type KdvRow = KdvInputTxn & {
  amount: number;
  net_amount: number | null;
  vat_rate: number | null;
  description: string | null;
  contact_name: string | null;
  partner_name: string | null;
};

const WINDOW_KINDS: readonly TransactionKind[] = [
  ...VAT_COLLECTED_KINDS,
  ...VAT_PAID_KINDS,
  "tax_payment",
];

export function windowStartIso(monthsBack: number, now: Date = new Date()): string {
  const current = istanbulYearMonth(now);
  const oldest = shiftYearMonth(current, -(monthsBack - 1));
  return `${oldest}-01`;
}

export async function listKdvWindow(
  monthsBack: number = 12,
  now: Date = new Date(),
): Promise<KdvRow[]> {
  const supabase = createClient();
  const start = windowStartIso(monthsBack, now);

  const { data, error } = await supabase
    .from("transactions")
    .select(
      `id, transaction_date, created_time, kind, currency, amount, vat_amount, vat_rate, net_amount, kdv_period, reference_number, description,
       contacts:contacts!transactions_contact_id_fkey(company_name),
       partners:partners!transactions_partner_id_fkey(name)`,
    )
    .gte("transaction_date", start)
    .in("kind", WINDOW_KINDS as unknown as string[])
    .order("transaction_date", { ascending: false })
    .order("id", { ascending: false });

  if (error) throw error;

  type Raw = {
    id: string;
    transaction_date: string;
    created_time: string | null;
    kind: string;
    currency: string;
    amount: number | string;
    vat_amount: number | string | null;
    vat_rate: number | string | null;
    net_amount: number | string | null;
    kdv_period: string | null;
    reference_number: string | null;
    description: string | null;
    contacts: { company_name: string | null } | null;
    partners: { name: string | null } | null;
  };

  return (data as unknown as Raw[]).map((r) => ({
    id: r.id,
    transaction_date: r.transaction_date,
    created_time: r.created_time,
    kind: r.kind as TransactionKind,
    currency: r.currency,
    amount: Number(r.amount),
    vat_amount: r.vat_amount == null ? null : Number(r.vat_amount),
    vat_rate: r.vat_rate == null ? null : Number(r.vat_rate),
    net_amount: r.net_amount == null ? null : Number(r.net_amount),
    kdv_period: r.kdv_period,
    reference_number: r.reference_number,
    description: r.description,
    contact_name: r.contacts?.company_name ?? null,
    partner_name: r.partners?.name ?? null,
  }));
}
