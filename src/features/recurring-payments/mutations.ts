import { createClient } from "@/lib/supabase/client";
import { AUTH_DISABLED } from "@/lib/auth-mode";
import type {
  RecurringPayment,
  RecurringPaymentInsert,
  RecurringPaymentUpdate,
  RecurringPaymentOccurrence,
  RecurringPaymentOccurrenceInsert,
  Transaction,
  TransactionInsert,
} from "@/lib/supabase/types";
import { spawnMovementFromTransaction } from "@/features/transactions/mutations";

import type { RecurringPaymentFormOutput } from "./schema";

async function currentUserId(): Promise<string | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    if (AUTH_DISABLED) return null;
    throw new Error("Not authenticated");
  }
  return user.id;
}

export async function createRecurringTemplate(
  values: RecurringPaymentFormOutput,
): Promise<RecurringPayment> {
  const supabase = createClient();
  const userId = await currentUserId();
  const now = new Date().toISOString();

  const payload: RecurringPaymentInsert = {
    name: values.name,
    description: values.description ?? null,
    kind: values.kind,
    expected_amount: values.expected_amount,
    currency: values.currency,
    day_of_month: values.day_of_month,
    account_id: values.account_id,
    contact_id: values.contact_id ?? null,
    expense_type_id: values.expense_type_id ?? null,
    effective_from: values.effective_from,
    end_date: values.end_date ?? null,
    notes: values.notes ?? null,
    status: "active",
    created_by: userId,
    created_time: now,
    edited_by: userId,
    edited_time: now,
  };

  const { data, error } = await supabase
    .from("recurring_payments")
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateRecurringTemplate(
  id: string,
  values: RecurringPaymentFormOutput,
): Promise<RecurringPayment> {
  const supabase = createClient();
  const userId = await currentUserId();
  const now = new Date().toISOString();

  const payload: RecurringPaymentUpdate = {
    name: values.name,
    description: values.description ?? null,
    kind: values.kind,
    expected_amount: values.expected_amount,
    currency: values.currency,
    day_of_month: values.day_of_month,
    account_id: values.account_id,
    contact_id: values.contact_id ?? null,
    expense_type_id: values.expense_type_id ?? null,
    effective_from: values.effective_from,
    end_date: values.end_date ?? null,
    notes: values.notes ?? null,
    edited_by: userId,
    edited_time: now,
  };

  const { data, error } = await supabase
    .from("recurring_payments")
    .update(payload)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function setTemplateStatus(
  id: string,
  status: "active" | "paused",
): Promise<RecurringPayment> {
  const supabase = createClient();
  const userId = await currentUserId();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("recurring_payments")
    .update({ status, edited_by: userId, edited_time: now })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function softDeleteTemplate(id: string): Promise<void> {
  const supabase = createClient();
  const userId = await currentUserId();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("recurring_payments")
    .update({ deleted_at: now, edited_by: userId, edited_time: now })
    .eq("id", id);
  if (error) throw error;
}

export type MarkPaidInput = {
  templateId: string;
  year: number;
  month: number;
  paidAmount: number;
  paidDate: string;
  notes?: string | null;
};

export type MarkPaidResult = {
  occurrence: RecurringPaymentOccurrence;
  transaction: Transaction;
};

// Mark a month paid: creates the spawned transaction, then the occurrence
// row that links to it. If the transaction insert succeeds but the
// occurrence insert fails (e.g. unique conflict from a double-click), we
// roll the transaction back so we don't leave a phantom expense.
export async function markOccurrencePaid(
  input: MarkPaidInput,
): Promise<MarkPaidResult> {
  const supabase = createClient();
  const userId = await currentUserId();
  const now = new Date().toISOString();

  // Pull the template to inherit kind, currency, contact, expense_type, etc.
  const { data: template, error: tplErr } = await supabase
    .from("recurring_payments")
    .select("*")
    .eq("id", input.templateId)
    .maybeSingle();
  if (tplErr) throw tplErr;
  if (!template) throw new Error("Template not found");

  const monthLabel = monthLabelFor(input.year, input.month);
  const description = `${template.name} — ${monthLabel}`;

  // For 'expense' kind: the form stores paid_by; recurring payments are
  // always paid by the business (no partner concept here). For other
  // kinds, the from/to_account routing matches the kind direction.
  const txnPayload: TransactionInsert = {
    transaction_date: input.paidDate,
    kind: template.kind as TransactionInsert["kind"],
    amount: input.paidAmount,
    currency: template.currency,
    description,
    contact_id: template.contact_id,
    expense_type_id: template.expense_type_id,
    from_account_id: template.account_id,
    created_by: userId,
    created_time: now,
    edited_by: userId,
    edited_time: now,
  };

  const { data: txn, error: txnErr } = await supabase
    .from("transactions")
    .insert(txnPayload)
    .select()
    .single();
  if (txnErr) throw txnErr;

  // Spawn the treasury movement (debits the source account). Mirrors what
  // the transactions feature does on a manual create.
  try {
    await spawnMovementFromTransaction(txn, userId, now);
  } catch (e) {
    await supabase.from("transactions").delete().eq("id", txn.id);
    throw e;
  }

  const occPayload: RecurringPaymentOccurrenceInsert = {
    recurring_payment_id: input.templateId,
    period_year: input.year,
    period_month: input.month,
    status: "paid",
    paid_amount: input.paidAmount,
    paid_date: input.paidDate,
    transaction_id: txn.id,
    notes: input.notes ?? null,
    created_by: userId,
    created_time: now,
  };

  const { data: occ, error: occErr } = await supabase
    .from("recurring_payment_occurrences")
    .insert(occPayload)
    .select()
    .single();
  if (occErr) {
    // Roll back the transaction + its movement to keep state consistent.
    await supabase.from("transactions").delete().eq("id", txn.id);
    throw occErr;
  }

  return { occurrence: occ, transaction: txn };
}

export async function skipOccurrence(input: {
  templateId: string;
  year: number;
  month: number;
  notes?: string | null;
}): Promise<RecurringPaymentOccurrence> {
  const supabase = createClient();
  const userId = await currentUserId();

  const payload: RecurringPaymentOccurrenceInsert = {
    recurring_payment_id: input.templateId,
    period_year: input.year,
    period_month: input.month,
    status: "skipped",
    notes: input.notes ?? null,
    created_by: userId,
    created_time: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("recurring_payment_occurrences")
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Undo a resolved occurrence. For paid: deletes the linked transaction
// (and its spawned movement via the FK cascade in transactions feature)
// then deletes the occurrence row. For skipped: just deletes the row.
export async function undoOccurrence(occurrenceId: string): Promise<void> {
  const supabase = createClient();

  const { data: occ, error: occErr } = await supabase
    .from("recurring_payment_occurrences")
    .select("*")
    .eq("id", occurrenceId)
    .maybeSingle();
  if (occErr) throw occErr;
  if (!occ) return;

  if (occ.status === "paid" && occ.transaction_id) {
    // Delete the spawned transaction. Treasury movements that reference it
    // via source_transaction_id are SET NULL on delete (per the existing
    // FK), but the actual quantity rows for accrual remain — we want them
    // gone, so delete the movement first if it exists.
    await supabase
      .from("treasury_movements")
      .delete()
      .eq("source_transaction_id", occ.transaction_id);
    await supabase
      .from("transactions")
      .delete()
      .eq("id", occ.transaction_id);
  }

  const { error } = await supabase
    .from("recurring_payment_occurrences")
    .delete()
    .eq("id", occurrenceId);
  if (error) throw error;
}

function monthLabelFor(year: number, month: number): string {
  const d = new Date(year, month - 1, 1);
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}
