import { createClient } from "@/lib/supabase/client";
import { AUTH_DISABLED } from "@/lib/auth-mode";
import { spawnMovementFromTransaction } from "@/features/transactions/mutations";
import type {
  BalanceCurrency,
  RealEstateDeal,
  RealEstateInstallment,
  RealEstateInstallmentInsert,
  RealEstateSubType,
  Transaction,
  TransactionInsert,
} from "@/lib/supabase/types";

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

export type InstallmentInput = {
  id?: string;
  due_date: string;
  expected_amount: number;
};

export type CreateDealInput = {
  label: string;
  sub_type: RealEstateSubType;
  contact_id: string;
  currency: BalanceCurrency;
  start_date: string;
  notes: string | null;
  installments: InstallmentInput[];
};

export type UpdateDealInput = CreateDealInput & { id: string };

export type CreateReceiptInput = {
  deal_id: string;
  transaction_date: string;
  amount: number;
  currency: BalanceCurrency;
  contact_id: string;
  to_account_id: string;
  description: string | null;
};

function assertDealValid(input: CreateDealInput): void {
  if (!input.label.trim()) throw new Error("Label is required");
  if (!input.contact_id) throw new Error("Pick a contact");
  if (!input.currency) throw new Error("Pick a currency");
  if (input.installments.length === 0) {
    throw new Error("At least one installment is required");
  }
  for (const i of input.installments) {
    if (!i.due_date) throw new Error("Each installment needs a due date");
    if (!Number.isFinite(i.expected_amount) || i.expected_amount <= 0) {
      throw new Error("Each installment needs a positive amount");
    }
  }
}

export async function createDeal(
  input: CreateDealInput,
): Promise<{ deal: RealEstateDeal; installments: RealEstateInstallment[] }> {
  assertDealValid(input);
  const supabase = createClient();
  const userId = await currentUserId();
  const now = new Date().toISOString();

  const { data: deal, error } = await supabase
    .from("real_estate_deals")
    .insert({
      label: input.label.trim(),
      sub_type: input.sub_type,
      contact_id: input.contact_id,
      currency: input.currency,
      start_date: input.start_date,
      notes: input.notes,
      created_by: userId,
      created_time: now,
      edited_by: userId,
      edited_time: now,
    })
    .select()
    .single();
  if (error) throw error;

  const payload: RealEstateInstallmentInsert[] = input.installments.map(
    (i, idx) => ({
      deal_id: deal.id,
      due_date: i.due_date,
      expected_amount: i.expected_amount,
      sequence: idx + 1,
    }),
  );
  const { data: installments, error: insErr } = await supabase
    .from("real_estate_installments")
    .insert(payload)
    .select();
  if (insErr) {
    await supabase.from("real_estate_deals").delete().eq("id", deal.id);
    throw insErr;
  }
  return { deal, installments: installments as RealEstateInstallment[] };
}

export async function updateDeal(
  input: UpdateDealInput,
): Promise<{ deal: RealEstateDeal; installments: RealEstateInstallment[] }> {
  assertDealValid(input);
  const supabase = createClient();
  const userId = await currentUserId();
  const now = new Date().toISOString();

  const { data: deal, error } = await supabase
    .from("real_estate_deals")
    .update({
      label: input.label.trim(),
      sub_type: input.sub_type,
      contact_id: input.contact_id,
      currency: input.currency,
      start_date: input.start_date,
      notes: input.notes,
      edited_by: userId,
      edited_time: now,
    })
    .eq("id", input.id)
    .select()
    .single();
  if (error) throw error;

  const { data: existing, error: exErr } = await supabase
    .from("real_estate_installments")
    .select("*")
    .eq("deal_id", input.id);
  if (exErr) throw exErr;

  const existingRows = (existing ?? []) as RealEstateInstallment[];
  const incomingIds = new Set(
    input.installments.filter((i) => i.id).map((i) => i.id!),
  );
  const toDelete = existingRows.filter((e) => !incomingIds.has(e.id));
  if (toDelete.length > 0) {
    const { error: delErr } = await supabase
      .from("real_estate_installments")
      .delete()
      .in("id", toDelete.map((d) => d.id));
    if (delErr) throw delErr;
  }

  const final: RealEstateInstallment[] = [];
  for (let idx = 0; idx < input.installments.length; idx += 1) {
    const inst = input.installments[idx];
    const sequence = idx + 1;
    if (inst.id) {
      const { data, error: updErr } = await supabase
        .from("real_estate_installments")
        .update({
          due_date: inst.due_date,
          expected_amount: inst.expected_amount,
          sequence,
        })
        .eq("id", inst.id)
        .select()
        .single();
      if (updErr) throw updErr;
      final.push(data as RealEstateInstallment);
    } else {
      const { data, error: insErr } = await supabase
        .from("real_estate_installments")
        .insert({
          deal_id: input.id,
          due_date: inst.due_date,
          expected_amount: inst.expected_amount,
          sequence,
        })
        .select()
        .single();
      if (insErr) throw insErr;
      final.push(data as RealEstateInstallment);
    }
  }

  return { deal, installments: final };
}

export async function softDeleteDeal(id: string): Promise<void> {
  const supabase = createClient();
  const userId = await currentUserId();
  const now = new Date().toISOString();

  const { count } = await supabase
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .eq("real_estate_deal_id", id);
  if (count && count > 0) {
    throw new Error(
      `Cannot delete: ${count} payment${count === 1 ? "" : "s"} are linked to this deal. Detach them first.`,
    );
  }

  const { error } = await supabase
    .from("real_estate_deals")
    .update({
      deleted_at: now,
      edited_by: userId,
      edited_time: now,
    })
    .eq("id", id);
  if (error) throw error;
}

export async function createReceipt(
  input: CreateReceiptInput,
): Promise<Transaction> {
  if (!input.deal_id) throw new Error("Pick a deal");
  if (!input.contact_id) throw new Error("Deal is missing a contact");
  if (!input.to_account_id) throw new Error("Pick a destination account");
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error("Amount must be positive");
  }

  const supabase = createClient();
  const userId = await currentUserId();
  const now = new Date().toISOString();

  const txnInsert: TransactionInsert = {
    kind: "client_payment",
    transaction_date: input.transaction_date,
    amount: input.amount,
    currency: input.currency,
    contact_id: input.contact_id,
    to_account_id: input.to_account_id,
    from_account_id: null,
    real_estate_deal_id: input.deal_id,
    description: input.description,
    created_by: userId,
    created_time: now,
    edited_by: userId,
    edited_time: now,
  };

  const { data: txn, error } = await supabase
    .from("transactions")
    .insert(txnInsert)
    .select()
    .single();
  if (error) throw error;

  try {
    await spawnMovementFromTransaction(txn, userId, now);
  } catch (err) {
    await supabase.from("transactions").delete().eq("id", txn.id);
    throw err;
  }
  return txn;
}
