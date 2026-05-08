import { createClient } from "@/lib/supabase/client";
import { allocateFifo, type LedgerEvent } from "@/lib/ledger/fifo-allocation";
import type {
  Contact,
  ContactNote,
  ContactWithCountry,
  Country,
} from "@/lib/supabase/types";

export const contactKeys = {
  all: ["contacts"] as const,
  list: () => [...contactKeys.all, "list"] as const,
  archive: () => [...contactKeys.all, "archive"] as const,
  detail: (id: string) => [...contactKeys.all, "detail", id] as const,
  notes: (id: string) => [...contactKeys.all, "notes", id] as const,
  // Balances live under the transactions key prefix so any transaction
  // mutation that invalidates ["transactions"] also clears them.
  balances: () => ["transactions", "contactBalances"] as const,
};

export const countryKeys = {
  all: ["countries"] as const,
};

export async function listContacts(): Promise<ContactWithCountry[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("contacts")
    .select("*, countries(code, name_en, flag_emoji)")
    .is("deleted_at", null)
    .order("company_name", { ascending: true });

  if (error) throw error;
  return (data ?? []) as ContactWithCountry[];
}

export async function listDeletedContacts(): Promise<ContactWithCountry[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("contacts")
    .select("*, countries(code, name_en, flag_emoji)")
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as ContactWithCountry[];
}

export async function getContact(id: string): Promise<ContactWithCountry | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("contacts")
    .select("*, countries(code, name_en, flag_emoji)")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw error;
  return (data ?? null) as ContactWithCountry | null;
}

export async function listCountries(): Promise<Country[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("countries")
    .select("*")
    .order("name_en", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export type ContactBalance = {
  contact_id: string;
  net_balance: number;
  currency: string;
  has_transactions: boolean;
  has_skipped: boolean;
};

type BalanceTxRow = {
  id: string;
  contact_id: string | null;
  kind: string;
  transaction_date: string;
  created_time: string | null;
  amount: number | string;
  currency: string;
  fx_converted_amount: number | string | null;
  fx_target_currency: string | null;
  related_shipment_id: string | null;
};

const BALANCE_KINDS = [
  "shipment_billing",
  "client_payment",
  "client_refund",
  "supplier_invoice",
  "supplier_payment",
] as const;

export async function listContactBalances(): Promise<ContactBalance[]> {
  const supabase = createClient();

  const [contactsRes, txRes] = await Promise.all([
    supabase
      .from("contacts")
      .select(
        "id, balance_currency, is_customer, is_supplier, is_logistics, is_real_estate, is_other",
      )
      .is("deleted_at", null),
    supabase
      .from("transactions")
      .select(
        "id, contact_id, kind, transaction_date, created_time, amount, currency, fx_converted_amount, fx_target_currency, related_shipment_id",
      )
      .in("kind", BALANCE_KINDS as unknown as string[])
      .not("contact_id", "is", null),
  ]);

  if (contactsRes.error) throw contactsRes.error;
  if (txRes.error) throw txRes.error;

  const byContact = new Map<string, BalanceTxRow[]>();
  for (const row of (txRes.data ?? []) as BalanceTxRow[]) {
    if (!row.contact_id) continue;
    const list = byContact.get(row.contact_id);
    if (list) list.push(row);
    else byContact.set(row.contact_id, [row]);
  }

  const out: ContactBalance[] = [];
  for (const c of contactsRes.data ?? []) {
    if (!c.balance_currency) continue;
    const rows = byContact.get(c.id) ?? [];
    if (rows.length === 0) {
      out.push({
        contact_id: c.id,
        net_balance: 0,
        currency: c.balance_currency,
        has_transactions: false,
        has_skipped: false,
      });
      continue;
    }

    // For dual-role contacts (customer + supplier on the same record),
    // the supplier ledger takes precedence in the contacts list balance
    // column. The contact detail page renders both ledgers stacked.
    const isSupplierLike = c.is_supplier || c.is_logistics;

    if (isSupplierLike) {
      let net = 0;
      let skipped = 0;
      for (const r of rows) {
        if (r.kind !== "supplier_invoice" && r.kind !== "supplier_payment") {
          continue;
        }
        if (r.currency !== c.balance_currency) {
          skipped += 1;
          continue;
        }
        const amt = Number(r.amount);
        if (r.kind === "supplier_invoice") net += amt;
        else net -= amt;
      }
      out.push({
        contact_id: c.id,
        net_balance: net,
        currency: c.balance_currency,
        has_transactions: true,
        has_skipped: skipped > 0,
      });
      continue;
    }

    const events: LedgerEvent[] = rows
      .filter(
        (r) =>
          r.kind === "shipment_billing" ||
          r.kind === "client_payment" ||
          r.kind === "client_refund",
      )
      .map((r) => ({
        id: r.id,
        date: r.transaction_date,
        created_time: r.created_time,
        kind: r.kind as LedgerEvent["kind"],
        amount: Number(r.amount),
        currency: r.currency,
        related_shipment_id: r.related_shipment_id,
        fx_converted_amount:
          r.fx_converted_amount === null ? null : Number(r.fx_converted_amount),
        fx_target_currency: r.fx_target_currency,
      }));

    if (events.length === 0) {
      out.push({
        contact_id: c.id,
        net_balance: 0,
        currency: c.balance_currency,
        has_transactions: false,
        has_skipped: false,
      });
      continue;
    }

    const fifo = allocateFifo(events, c.balance_currency);
    out.push({
      contact_id: c.id,
      net_balance: fifo.net_balance,
      currency: c.balance_currency,
      has_transactions: true,
      has_skipped: fifo.skipped_events.length > 0,
    });
  }

  return out;
}

export async function listContactNotes(contactId: string): Promise<ContactNote[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("contact_notes")
    .select("*")
    .eq("contact_id", contactId)
    .order("note_date", { ascending: false })
    .order("created_time", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export type { Contact };
