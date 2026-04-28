import { createClient } from "@/lib/supabase/client";
import { TRANSACTION_ATTACHMENT_BUCKET } from "@/lib/constants";
import type {
  Account,
  Contact,
  CustodyLocation,
  ExpenseType,
  Partner,
  Transaction,
} from "@/lib/supabase/types";

export type TransactionWithRelations = Transaction & {
  contacts:
    | (Pick<Contact, "id" | "company_name" | "balance_currency"> & {
        type: Contact["type"];
      })
    | null;
  partners: Pick<Partner, "id" | "name"> | null;
  from_account:
    | (Pick<Account, "id" | "account_name" | "asset_code"> & {
        custody_locations: Pick<CustodyLocation, "id" | "name"> | null;
      })
    | null;
  to_account:
    | (Pick<Account, "id" | "account_name" | "asset_code"> & {
        custody_locations: Pick<CustodyLocation, "id" | "name"> | null;
      })
    | null;
  expense_types: Pick<ExpenseType, "id" | "name"> | null;
  related_payable: Pick<
    Transaction,
    "id" | "reference_number" | "transaction_date" | "amount" | "currency"
  > | null;
};

export type UnpaidSupplierInvoice = {
  id: string;
  reference_number: string | null;
  transaction_date: string;
  amount: number;
  currency: string;
  outstanding: number;
};

export const transactionKeys = {
  all: ["transactions"] as const,
  list: (filters?: Record<string, unknown>) =>
    [...transactionKeys.all, "list", filters ?? {}] as const,
  partners: () => [...transactionKeys.all, "partners"] as const,
  expenseTypes: () => [...transactionKeys.all, "expense_types"] as const,
  unpaidInvoices: (supplierId: string, includeInvoiceId?: string | null) =>
    [
      ...transactionKeys.all,
      "unpaidInvoices",
      supplierId,
      includeInvoiceId ?? "",
    ] as const,
  byContact: (contactId: string) =>
    [...transactionKeys.all, "byContact", contactId] as const,
  bySupplier: (contactId: string) =>
    [...transactionKeys.all, "bySupplier", contactId] as const,
  supplierContacts: () =>
    [...transactionKeys.all, "supplierContacts"] as const,
};

export type ContactLedgerRow = Transaction & {
  related_shipment:
    | { id: string; name: string | null; invoice_currency: string | null }
    | null;
};

const CONTACT_LEDGER_KINDS = [
  "shipment_billing",
  "client_payment",
  "client_refund",
] as const;

export async function listTransactionsForContact(
  contactId: string,
): Promise<ContactLedgerRow[]> {
  if (!contactId) return [];
  const supabase = createClient();
  const { data, error } = await supabase
    .from("transactions")
    .select(
      "*, related_shipment:shipments!transactions_related_shipment_id_fkey(id, name, invoice_currency)",
    )
    .eq("contact_id", contactId)
    .in("kind", CONTACT_LEDGER_KINDS as unknown as string[])
    .order("transaction_date", { ascending: true })
    .order("id", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as ContactLedgerRow[];
}

const TRANSACTION_SELECT = `
  *,
  contacts:contacts!transactions_contact_id_fkey(id, company_name, balance_currency, type),
  partners:partners!transactions_partner_id_fkey(id, name),
  from_account:accounts!transactions_from_account_id_fkey(
    id, account_name, asset_code,
    custody_locations:custody_locations!accounts_custody_location_id_fkey(id, name)
  ),
  to_account:accounts!transactions_to_account_id_fkey(
    id, account_name, asset_code,
    custody_locations:custody_locations!accounts_custody_location_id_fkey(id, name)
  ),
  expense_types:expense_types!transactions_expense_type_id_fkey(id, name),
  related_payable:transactions!related_payable_id(
    id, reference_number, transaction_date, amount, currency
  )
`;

export async function listTransactions(): Promise<TransactionWithRelations[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("transactions")
    .select(TRANSACTION_SELECT)
    .order("transaction_date", { ascending: false })
    .order("created_time", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as TransactionWithRelations[];
}

export async function listPartners({
  activeOnly = true,
}: { activeOnly?: boolean } = {}): Promise<Partner[]> {
  const supabase = createClient();
  let q = supabase
    .from("partners")
    .select("*")
    .is("deleted_at", null)
    .order("name", { ascending: true });
  if (activeOnly) q = q.eq("is_active", true);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function listExpenseTypes(): Promise<ExpenseType[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("expense_types")
    .select("*")
    .order("name", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function attachmentSignedUrl(
  path: string,
  expiresInSec = 3600,
): Promise<string | null> {
  const supabase = createClient();
  const { data, error } = await supabase.storage
    .from(TRANSACTION_ATTACHMENT_BUCKET)
    .createSignedUrl(path, expiresInSec);
  if (error) return null;
  return data?.signedUrl ?? null;
}

export type SupplierContactSummary = Pick<Contact, "id" | "company_name">;

export async function listSupplierContacts(): Promise<SupplierContactSummary[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("contacts")
    .select("id, company_name")
    .eq("type", "supplier")
    .is("deleted_at", null)
    .order("company_name", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export type SupplierInvoiceRow = Pick<
  Transaction,
  "id" | "reference_number" | "transaction_date" | "amount" | "currency"
>;

export type SupplierPaymentRow = Pick<
  Transaction,
  | "id"
  | "transaction_date"
  | "amount"
  | "currency"
  | "related_payable_id"
> & {
  related_payable:
    | Pick<Transaction, "id" | "reference_number">
    | null;
};

export type SupplierLedgerData = {
  invoices: SupplierInvoiceRow[];
  payments: SupplierPaymentRow[];
};

export async function listTransactionsForSupplier(
  contactId: string,
): Promise<SupplierLedgerData> {
  if (!contactId) return { invoices: [], payments: [] };
  const supabase = createClient();

  const { data: invoices, error: invErr } = await supabase
    .from("transactions")
    .select("id, reference_number, transaction_date, amount, currency")
    .eq("kind", "supplier_invoice")
    .eq("contact_id", contactId)
    .order("transaction_date", { ascending: true })
    .order("id", { ascending: true });
  if (invErr) throw invErr;

  const { data: payments, error: payErr } = await supabase
    .from("transactions")
    .select(
      "id, transaction_date, amount, currency, related_payable_id, related_payable:transactions!related_payable_id(id, reference_number)",
    )
    .eq("kind", "supplier_payment")
    .eq("contact_id", contactId)
    .order("transaction_date", { ascending: true })
    .order("id", { ascending: true });
  if (payErr) throw payErr;

  return {
    invoices: (invoices ?? []) as SupplierInvoiceRow[],
    payments: (payments ?? []) as unknown as SupplierPaymentRow[],
  };
}

export function computeOutstandingByInvoice(
  invoices: Pick<Transaction, "id" | "amount">[],
  payments: Pick<Transaction, "related_payable_id" | "amount">[],
): Map<string, number> {
  const paidByInvoice = new Map<string, number>();
  for (const p of payments) {
    const rid = p.related_payable_id as string | null;
    if (!rid) continue;
    const prev = paidByInvoice.get(rid) ?? 0;
    paidByInvoice.set(rid, prev + Number(p.amount));
  }
  const outstanding = new Map<string, number>();
  for (const inv of invoices) {
    const paid = paidByInvoice.get(inv.id) ?? 0;
    outstanding.set(inv.id, Number(inv.amount) - paid);
  }
  return outstanding;
}

export async function listUnpaidSupplierInvoices(
  supplierId: string,
  includeInvoiceId?: string | null,
): Promise<UnpaidSupplierInvoice[]> {
  if (!supplierId) return [];
  const supabase = createClient();

  const { data: invoices, error: invErr } = await supabase
    .from("transactions")
    .select("id, reference_number, transaction_date, amount, currency")
    .eq("kind", "supplier_invoice")
    .eq("contact_id", supplierId)
    .order("transaction_date", { ascending: true });
  if (invErr) throw invErr;
  const invoiceRows = invoices ?? [];
  if (invoiceRows.length === 0 && !includeInvoiceId) return [];

  const invoiceIds = invoiceRows.map((i) => i.id);
  const paymentsById = new Map<string, number>();
  if (invoiceIds.length > 0) {
    const { data: payments, error: payErr } = await supabase
      .from("transactions")
      .select("related_payable_id, amount")
      .eq("kind", "supplier_payment")
      .in("related_payable_id", invoiceIds);
    if (payErr) throw payErr;
    for (const p of payments ?? []) {
      const rid = p.related_payable_id as string | null;
      if (!rid) continue;
      const prev = paymentsById.get(rid) ?? 0;
      paymentsById.set(rid, prev + Number(p.amount));
    }
  }

  const merged: UnpaidSupplierInvoice[] = [];
  for (const inv of invoiceRows) {
    const paid = paymentsById.get(inv.id) ?? 0;
    const outstanding = Number(inv.amount) - paid;
    const shouldInclude = outstanding > 0 || inv.id === includeInvoiceId;
    if (!shouldInclude) continue;
    merged.push({
      id: inv.id,
      reference_number: inv.reference_number,
      transaction_date: inv.transaction_date,
      amount: Number(inv.amount),
      currency: inv.currency,
      outstanding,
    });
  }

  if (
    includeInvoiceId &&
    !merged.find((m) => m.id === includeInvoiceId)
  ) {
    const { data: extra, error: extraErr } = await supabase
      .from("transactions")
      .select("id, reference_number, transaction_date, amount, currency, contact_id")
      .eq("id", includeInvoiceId)
      .maybeSingle();
    if (extraErr) throw extraErr;
    if (extra && extra.contact_id === supplierId) {
      const paid = paymentsById.get(extra.id) ?? 0;
      merged.push({
        id: extra.id,
        reference_number: extra.reference_number,
        transaction_date: extra.transaction_date,
        amount: Number(extra.amount),
        currency: extra.currency,
        outstanding: Number(extra.amount) - paid,
      });
    }
  }

  merged.sort((a, b) => a.transaction_date.localeCompare(b.transaction_date));
  return merged;
}
