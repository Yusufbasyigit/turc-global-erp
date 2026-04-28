import { createClient } from "@/lib/supabase/client";
import type {
  Account,
  Contact,
  ExpenseType,
  RecurringPayment,
  RecurringPaymentOccurrence,
} from "@/lib/supabase/types";

export const recurringPaymentKeys = {
  all: ["recurring_payments"] as const,
  templates: () => [...recurringPaymentKeys.all, "templates"] as const,
  template: (id: string) =>
    [...recurringPaymentKeys.all, "template", id] as const,
  monthly: (year: number, month: number) =>
    [...recurringPaymentKeys.all, "monthly", year, month] as const,
  history: (templateId: string) =>
    [...recurringPaymentKeys.all, "history", templateId] as const,
  pendingCount: (year: number, month: number) =>
    [...recurringPaymentKeys.all, "pendingCount", year, month] as const,
};

export type RecurringPaymentWithRelations = RecurringPayment & {
  account: Pick<
    Account,
    "id" | "account_name" | "asset_code" | "asset_type"
  > | null;
  contact: Pick<Contact, "id" | "company_name"> | null;
  expense_type: Pick<ExpenseType, "id" | "name"> | null;
};

const TEMPLATE_SELECT = `
  *,
  account:accounts!recurring_payments_account_id_fkey(
    id, account_name, asset_code, asset_type
  ),
  contact:contacts!recurring_payments_contact_id_fkey(id, company_name),
  expense_type:expense_types!recurring_payments_expense_type_id_fkey(id, name)
`;

export async function listRecurringTemplates(): Promise<
  RecurringPaymentWithRelations[]
> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("recurring_payments")
    .select(TEMPLATE_SELECT)
    .is("deleted_at", null)
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as RecurringPaymentWithRelations[];
}

export async function getRecurringTemplate(
  id: string,
): Promise<RecurringPaymentWithRelations | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("recurring_payments")
    .select(TEMPLATE_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as unknown as RecurringPaymentWithRelations | null;
}

// Lazy materialization: occurrence rows exist only for resolved months
// (paid or skipped). This query joins the active templates to whatever
// occurrence row exists for (year, month), so callers can render
// "pending" for templates without a row.
export type MonthlyOccurrenceRow = {
  template: RecurringPaymentWithRelations;
  occurrence: RecurringPaymentOccurrence | null;
};

export async function listMonthlyOccurrences(
  year: number,
  month: number,
): Promise<MonthlyOccurrenceRow[]> {
  const supabase = createClient();

  const lastDay = lastDayOfMonth(year, month);
  const firstDay = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDayStr = `${year}-${String(month).padStart(2, "0")}-${String(
    lastDay,
  ).padStart(2, "0")}`;

  // Active templates that overlap this month. Effective_from <= last day,
  // and end_date is null or >= first day.
  const { data: templates, error: tplErr } = await supabase
    .from("recurring_payments")
    .select(TEMPLATE_SELECT)
    .is("deleted_at", null)
    .eq("status", "active")
    .lte("effective_from", lastDayStr)
    .or(`end_date.is.null,end_date.gte.${firstDay}`)
    .order("day_of_month", { ascending: true });
  if (tplErr) throw tplErr;

  const tplRows = (templates ?? []) as unknown as RecurringPaymentWithRelations[];
  if (tplRows.length === 0) return [];

  // Pull occurrences for these templates in the given period.
  const { data: occRows, error: occErr } = await supabase
    .from("recurring_payment_occurrences")
    .select("*")
    .eq("period_year", year)
    .eq("period_month", month)
    .in(
      "recurring_payment_id",
      tplRows.map((t) => t.id),
    );
  if (occErr) throw occErr;

  const occByTemplate = new Map<string, RecurringPaymentOccurrence>();
  for (const o of occRows ?? []) {
    occByTemplate.set(
      (o as RecurringPaymentOccurrence).recurring_payment_id,
      o as RecurringPaymentOccurrence,
    );
  }

  return tplRows.map((t) => ({
    template: t,
    occurrence: occByTemplate.get(t.id) ?? null,
  }));
}

// History per template — every paid/skipped month, newest first.
export type HistoryRow = RecurringPaymentOccurrence & {
  transaction:
    | { id: string; transaction_date: string; amount: number; currency: string }
    | null;
};

export async function listTemplateHistory(
  templateId: string,
): Promise<HistoryRow[]> {
  if (!templateId) return [];
  const supabase = createClient();
  const { data, error } = await supabase
    .from("recurring_payment_occurrences")
    .select(
      `*, transaction:transactions!recurring_payment_occurrences_transaction_id_fkey(id, transaction_date, amount, currency)`,
    )
    .eq("recurring_payment_id", templateId)
    .order("period_year", { ascending: false })
    .order("period_month", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as HistoryRow[];
}

// Pending count for the given month — for the badge on the Transactions
// page header. Uses the same overlap logic as listMonthlyOccurrences.
export async function pendingCountForMonth(
  year: number,
  month: number,
): Promise<number> {
  const rows = await listMonthlyOccurrences(year, month);
  return rows.filter((r) => r.occurrence === null).length;
}

function lastDayOfMonth(year: number, month: number): number {
  // Date(year, month, 0) returns the last day of the previous month, so
  // passing `month` (1-indexed) gives the last day of that month.
  return new Date(year, month, 0).getDate();
}

// Used in app code to clamp a template's day_of_month to the actual last
// day for short months (e.g. day=31 in February).
export function effectiveDayForMonth(
  dayOfMonth: number,
  year: number,
  month: number,
): number {
  return Math.min(dayOfMonth, lastDayOfMonth(year, month));
}
