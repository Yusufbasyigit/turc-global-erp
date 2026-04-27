import { createClient } from "@/lib/supabase/client";
import { AUTH_DISABLED } from "@/lib/auth-mode";
import { spawnMovementFromTransaction } from "@/features/transactions/mutations";
import type {
  BalanceCurrency,
  LoanInstallment,
  LoanInstallmentInsert,
  Transaction,
  TransactionInsert,
  TransactionUpdate,
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

export type LoanInstallmentInput = {
  id?: string;
  due_date: string;
  amount: number;
};

export type CreateLoanInput = {
  partner_id: string;
  transaction_date: string;
  currency: BalanceCurrency;
  from_account_id: string;
  amount: number;
  description: string | null;
  installments: LoanInstallmentInput[];
};

export type UpdateLoanInput = CreateLoanInput & { id: string };

export type RecordRepaymentInput = {
  partner_id: string;
  currency: BalanceCurrency;
  to_account_id: string;
  amount: number;
  transaction_date: string;
  description: string | null;
};

function assertLoanValid(input: CreateLoanInput): void {
  if (!input.partner_id) throw new Error("Pick a partner");
  if (!input.from_account_id) throw new Error("Pick a source account");
  if (!input.currency) throw new Error("Pick a currency");
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error("Loan amount must be positive");
  }
  for (const inst of input.installments) {
    if (!inst.due_date) throw new Error("Each installment needs a due date");
    if (!Number.isFinite(inst.amount) || inst.amount <= 0) {
      throw new Error("Each installment needs a positive amount");
    }
  }
}

async function insertInstallments(
  loanTransactionId: string,
  currency: string,
  installments: LoanInstallmentInput[],
): Promise<LoanInstallment[]> {
  if (installments.length === 0) return [];
  const supabase = createClient();
  const payload: LoanInstallmentInsert[] = installments.map((i) => ({
    loan_transaction_id: loanTransactionId,
    due_date: i.due_date,
    amount: i.amount,
    currency,
  }));
  const { data, error } = await supabase
    .from("loan_installments")
    .insert(payload)
    .select();
  if (error) throw error;
  return (data ?? []) as LoanInstallment[];
}

export async function createLoan(
  input: CreateLoanInput,
): Promise<{ loan: Transaction; installments: LoanInstallment[] }> {
  assertLoanValid(input);
  const supabase = createClient();
  const userId = await currentUserId();
  const now = new Date().toISOString();

  const txnInsert: TransactionInsert = {
    kind: "partner_loan_out",
    transaction_date: input.transaction_date,
    amount: input.amount,
    currency: input.currency,
    from_account_id: input.from_account_id,
    to_account_id: null,
    contact_id: null,
    partner_id: input.partner_id,
    is_loan: true,
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

  let installments: LoanInstallment[] = [];
  try {
    installments = await insertInstallments(
      txn.id,
      input.currency,
      input.installments,
    );
  } catch (err) {
    await supabase
      .from("treasury_movements")
      .delete()
      .eq("source_transaction_id", txn.id);
    await supabase.from("transactions").delete().eq("id", txn.id);
    throw err;
  }

  return { loan: txn, installments };
}

export async function updateLoan(
  input: UpdateLoanInput,
): Promise<{ loan: Transaction; installments: LoanInstallment[] }> {
  assertLoanValid(input);
  const supabase = createClient();
  const userId = await currentUserId();
  const now = new Date().toISOString();

  const txnUpdate: TransactionUpdate = {
    transaction_date: input.transaction_date,
    amount: input.amount,
    currency: input.currency,
    from_account_id: input.from_account_id,
    partner_id: input.partner_id,
    description: input.description,
    edited_by: userId,
    edited_time: now,
  };
  const { data: txn, error } = await supabase
    .from("transactions")
    .update(txnUpdate)
    .eq("id", input.id)
    .select()
    .single();
  if (error) throw error;

  // Mirror the linked treasury movement.
  const { error: mvErr } = await supabase
    .from("treasury_movements")
    .update({
      account_id: input.from_account_id,
      movement_date: input.transaction_date,
      quantity: -Math.abs(input.amount),
      notes: input.description,
      edited_by: userId,
      edited_time: now,
    })
    .eq("source_transaction_id", input.id);
  if (mvErr) throw mvErr;

  // Reconcile installments: delete missing, update kept, insert new.
  const { data: existing, error: exErr } = await supabase
    .from("loan_installments")
    .select("*")
    .eq("loan_transaction_id", input.id);
  if (exErr) throw exErr;

  const existingRows = (existing ?? []) as LoanInstallment[];
  const incomingIds = new Set(
    input.installments.filter((i) => i.id).map((i) => i.id!),
  );
  const toDelete = existingRows.filter((e) => !incomingIds.has(e.id));
  if (toDelete.length > 0) {
    const { error: delErr } = await supabase
      .from("loan_installments")
      .delete()
      .in(
        "id",
        toDelete.map((d) => d.id),
      );
    if (delErr) throw delErr;
  }

  const final: LoanInstallment[] = [];
  for (const inst of input.installments) {
    if (inst.id) {
      const { data: upd, error: updErr } = await supabase
        .from("loan_installments")
        .update({
          due_date: inst.due_date,
          amount: inst.amount,
          currency: input.currency,
        })
        .eq("id", inst.id)
        .select()
        .single();
      if (updErr) throw updErr;
      final.push(upd as LoanInstallment);
    } else {
      const { data: ins, error: insErr } = await supabase
        .from("loan_installments")
        .insert({
          loan_transaction_id: input.id,
          due_date: inst.due_date,
          amount: inst.amount,
          currency: input.currency,
        })
        .select()
        .single();
      if (insErr) throw insErr;
      final.push(ins as LoanInstallment);
    }
  }

  return { loan: txn, installments: final };
}

export async function deleteLoan(id: string): Promise<void> {
  const supabase = createClient();
  // Drop the treasury movement first; loan_installments cascade with the txn.
  const { error: mvErr } = await supabase
    .from("treasury_movements")
    .delete()
    .eq("source_transaction_id", id);
  if (mvErr) throw mvErr;
  const { error } = await supabase.from("transactions").delete().eq("id", id);
  if (error) throw error;
}

export async function recordRepayment(
  input: RecordRepaymentInput,
): Promise<Transaction> {
  if (!input.partner_id) throw new Error("Pick a partner");
  if (!input.to_account_id) throw new Error("Pick a destination account");
  if (!input.currency) throw new Error("Pick a currency");
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error("Repayment amount must be positive");
  }

  const supabase = createClient();
  const userId = await currentUserId();
  const now = new Date().toISOString();

  const txnInsert: TransactionInsert = {
    kind: "partner_loan_in",
    transaction_date: input.transaction_date,
    amount: input.amount,
    currency: input.currency,
    from_account_id: null,
    to_account_id: input.to_account_id,
    contact_id: null,
    partner_id: input.partner_id,
    is_loan: true,
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
