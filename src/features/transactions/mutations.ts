import { createClient } from "@/lib/supabase/client";
import { AUTH_DISABLED } from "@/lib/auth-mode";
import { TRANSACTION_ATTACHMENT_BUCKET } from "@/lib/constants";
import type {
  ExpenseType,
  ExpenseTypeInsert,
  OrtakMovementType,
  Partner,
  PartnerInsert,
  Transaction,
  TransactionInsert,
  TransactionUpdate,
  TreasuryMovement,
  TreasuryMovementInsert,
  TreasuryMovementUpdate,
} from "@/lib/supabase/types";
import { KIND_SPAWN_DIRECTION } from "./constants";

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

async function custodyRequiresMovementType(
  accountId: string,
): Promise<boolean> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("accounts")
    .select(
      `custody_locations:custody_locations!accounts_custody_location_id_fkey(requires_movement_type)`,
    )
    .eq("id", accountId)
    .maybeSingle();
  if (error) throw error;
  const rel = (
    data as unknown as {
      custody_locations: { requires_movement_type: boolean } | null;
    } | null
  )?.custody_locations;
  return !!rel?.requires_movement_type;
}

// Guard against the most insidious cash-touching bug: writing a USD payment
// against a TRY-denominated account. The treasury balance is a pure SUM(quantity)
// across an account, so adding a non-matching-currency amount silently corrupts
// the balance with no visible error until reconciliation.
export async function assertAccountCurrencyMatches(
  accountId: string,
  currency: string,
): Promise<void> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("accounts")
    .select("asset_code")
    .eq("id", accountId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Account not found");
  if (data.asset_code !== currency) {
    throw new Error(
      `Account currency (${data.asset_code ?? "?"}) does not match transaction currency (${currency}). Pick an account that holds ${currency}.`,
    );
  }
}

function ortakTypeFor(kind: Transaction["kind"]): OrtakMovementType | null {
  if (kind === "partner_loan_in") return "partner_loan_in";
  if (kind === "partner_loan_out") return "partner_loan_out";
  if (kind === "profit_distribution") return "profit_share";
  return null;
}

function movementFieldsFromTransaction(
  txn: Transaction,
): null | {
  account_id: string;
  quantity: number;
  kind: "deposit" | "withdraw";
} {
  const direction = KIND_SPAWN_DIRECTION[txn.kind as keyof typeof KIND_SPAWN_DIRECTION];
  if (!direction) return null; // accrual kind — correctly no movement
  // Partner-paid expense is the only "direction set, no account" case that
  // is legitimate: a partner paid out of pocket, so the business treasury
  // is untouched. All other cash kinds require the matching account.
  if (txn.kind === "expense" && txn.partner_id && !txn.from_account_id) {
    return null;
  }
  const amount = Number(txn.amount);
  // Direction is set and a treasury account is required. Returning null
  // here would silently drop the treasury movement; throw instead so any
  // caller that bypasses the form schema fails loudly.
  if (direction === "deposit") {
    if (!txn.to_account_id) {
      throw new Error(
        `Transaction ${txn.id} (${txn.kind}) is missing to_account_id; cannot spawn deposit movement.`,
      );
    }
    return {
      account_id: txn.to_account_id,
      quantity: Math.abs(amount),
      kind: "deposit",
    };
  }
  if (!txn.from_account_id) {
    throw new Error(
      `Transaction ${txn.id} (${txn.kind}) is missing from_account_id; cannot spawn withdraw movement.`,
    );
  }
  return {
    account_id: txn.from_account_id,
    quantity: -Math.abs(amount),
    kind: "withdraw",
  };
}

export async function spawnMovementFromTransaction(
  txn: Transaction,
  userId: string | null,
  now: string,
): Promise<TreasuryMovement | null> {
  const supabase = createClient();
  const fields = movementFieldsFromTransaction(txn);
  if (!fields) return null;

  await assertAccountCurrencyMatches(fields.account_id, txn.currency);

  let ortak: OrtakMovementType | null = null;
  const derivedOrtak = ortakTypeFor(txn.kind as Transaction["kind"]);
  if (derivedOrtak) {
    const requires = await custodyRequiresMovementType(fields.account_id);
    if (requires) ortak = derivedOrtak;
  }

  const payload: TreasuryMovementInsert = {
    account_id: fields.account_id,
    movement_date: txn.transaction_date,
    kind: fields.kind,
    quantity: fields.quantity,
    notes: txn.description ?? null,
    ortak_movement_type: ortak,
    source_transaction_id: txn.id,
    created_by: userId,
    created_time: now,
  };

  const { data, error } = await supabase
    .from("treasury_movements")
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function findLinkedMovement(
  transactionId: string,
): Promise<TreasuryMovement | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("treasury_movements")
    .select("*")
    .eq("source_transaction_id", transactionId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function deleteLinkedMovement(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("treasury_movements")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export async function uploadAttachment(
  transactionId: string,
  file: File,
): Promise<string> {
  const supabase = createClient();
  const extMatch = file.name.match(/\.([a-zA-Z0-9]+)$/);
  const ext = extMatch ? extMatch[1].toLowerCase() : "bin";
  const path = `${transactionId}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from(TRANSACTION_ATTACHMENT_BUCKET)
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type,
    });
  if (error) throw error;
  return path;
}

export async function deleteAttachment(path: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.storage
    .from(TRANSACTION_ATTACHMENT_BUCKET)
    .remove([path]);
  if (error) throw error;
}

async function validateRelatedPayable(
  payload: Pick<
    TransactionInsert,
    "related_payable_id" | "contact_id" | "kind"
  > & { currency?: string | null | undefined },
): Promise<void> {
  const rpid = payload.related_payable_id;
  if (!rpid) return;
  if (payload.kind !== "supplier_payment") {
    throw new Error("related_payable_id can only be set on supplier_payment");
  }
  const supabase = createClient();
  const { data, error } = await supabase
    .from("transactions")
    .select("id, kind, contact_id, currency")
    .eq("id", rpid)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Linked invoice not found");
  if (data.kind !== "supplier_invoice") {
    throw new Error("Linked row must be a supplier_invoice");
  }
  if (data.contact_id !== payload.contact_id) {
    throw new Error("Linked invoice belongs to a different supplier");
  }
  if (payload.currency && data.currency !== payload.currency) {
    throw new Error(
      `Payment currency (${payload.currency}) does not match invoice currency (${data.currency}).`,
    );
  }
}

export async function createTransaction(input: {
  id: string;
  payload: Omit<TransactionInsert, "id" | "created_by" | "created_time" | "edited_by" | "edited_time">;
  pendingFile?: File | null;
}): Promise<{ transaction: Transaction; movement: TreasuryMovement | null }> {
  const supabase = createClient();
  const userId = await currentUserId();
  const now = new Date().toISOString();

  await validateRelatedPayable(input.payload);

  let attachmentPath: string | null = null;
  if (input.pendingFile) {
    attachmentPath = await uploadAttachment(input.id, input.pendingFile);
  }

  const insertPayload: TransactionInsert = {
    ...input.payload,
    id: input.id,
    attachment_path: attachmentPath,
    created_by: userId,
    created_time: now,
    edited_by: userId,
    edited_time: now,
  };

  const { data: transaction, error } = await supabase
    .from("transactions")
    .insert(insertPayload)
    .select()
    .single();

  if (error) {
    if (attachmentPath) {
      await deleteAttachment(attachmentPath).catch(() => {});
    }
    throw error;
  }

  try {
    const movement = await spawnMovementFromTransaction(transaction, userId, now);
    return { transaction, movement };
  } catch (err) {
    await supabase.from("transactions").delete().eq("id", transaction.id);
    if (attachmentPath) {
      await deleteAttachment(attachmentPath).catch(() => {});
    }
    throw err;
  }
}

export async function updateTransaction(input: {
  id: string;
  payload: Omit<TransactionUpdate, "id" | "created_by" | "created_time" | "edited_by" | "edited_time">;
  pendingFile?: File | null;
  removeAttachment?: boolean;
  previousAttachmentPath?: string | null;
}): Promise<{ transaction: Transaction; movement: TreasuryMovement | null }> {
  const supabase = createClient();
  const userId = await currentUserId();
  const now = new Date().toISOString();

  if (input.payload.related_payable_id) {
    await validateRelatedPayable({
      related_payable_id: input.payload.related_payable_id,
      contact_id: input.payload.contact_id ?? null,
      kind: (input.payload.kind ?? "supplier_payment") as TransactionInsert["kind"],
      currency: input.payload.currency ?? undefined,
    });
  }

  // Mirror the payment-side validateRelatedPayable check on the invoice side:
  // if this transaction has supplier_payment children pointing at it via
  // related_payable_id, block currency/contact/kind edits that would silently
  // desync them. computeOutstandingByInvoice sums payment.amount currency-blind,
  // so a EUR invoice with a EUR payment that's then flipped to USD would show
  // outstanding = 1000 - 500 = 500 across mixed currencies.
  const isCurrencyChanging =
    "currency" in input.payload && input.payload.currency !== undefined;
  const isContactChanging =
    "contact_id" in input.payload && input.payload.contact_id !== undefined;
  const isKindChanging =
    "kind" in input.payload && input.payload.kind !== undefined;
  if (isCurrencyChanging || isContactChanging || isKindChanging) {
    const { data: existing, error: existingErr } = await supabase
      .from("transactions")
      .select("kind, currency, contact_id")
      .eq("id", input.id)
      .maybeSingle();
    if (existingErr) throw existingErr;
    if (existing && existing.kind === "supplier_invoice") {
      const currencyShift =
        isCurrencyChanging && existing.currency !== input.payload.currency;
      const contactShift =
        isContactChanging && existing.contact_id !== input.payload.contact_id;
      const kindShift =
        isKindChanging && existing.kind !== input.payload.kind;
      if (currencyShift || contactShift || kindShift) {
        const { count, error: pErr } = await supabase
          .from("transactions")
          .select("id", { count: "exact", head: true })
          .eq("related_payable_id", input.id);
        if (pErr) throw pErr;
        if ((count ?? 0) > 0) {
          throw new Error(
            `Cannot change ${currencyShift ? "currency" : contactShift ? "contact" : "kind"} on this supplier invoice: ${count} payment(s) link to it. Detach those payments first.`,
          );
        }
      }
    }
  }

  let nextAttachmentPath: string | null | undefined = undefined;

  if (input.removeAttachment && input.previousAttachmentPath) {
    await deleteAttachment(input.previousAttachmentPath).catch(() => {});
    nextAttachmentPath = null;
  }
  if (input.pendingFile) {
    const newPath = await uploadAttachment(input.id, input.pendingFile);
    if (input.previousAttachmentPath && input.previousAttachmentPath !== newPath) {
      await deleteAttachment(input.previousAttachmentPath).catch(() => {});
    }
    nextAttachmentPath = newPath;
  }

  const updatePayload: TransactionUpdate = {
    ...input.payload,
    ...(nextAttachmentPath !== undefined
      ? { attachment_path: nextAttachmentPath }
      : {}),
    edited_by: userId,
    edited_time: now,
  };

  const { data: transaction, error } = await supabase
    .from("transactions")
    .update(updatePayload)
    .eq("id", input.id)
    .select()
    .single();
  if (error) throw error;

  const existingMovement = await findLinkedMovement(transaction.id);
  const nextFields = movementFieldsFromTransaction(transaction);

  let movement: TreasuryMovement | null = null;

  if (existingMovement && !nextFields) {
    await deleteLinkedMovement(existingMovement.id);
    movement = null;
  } else if (existingMovement && nextFields) {
    await assertAccountCurrencyMatches(
      nextFields.account_id,
      transaction.currency,
    );
    const derivedOrtak = ortakTypeFor(transaction.kind as Transaction["kind"]);
    let ortak: OrtakMovementType | null = null;
    if (derivedOrtak) {
      const requires = await custodyRequiresMovementType(nextFields.account_id);
      if (requires) ortak = derivedOrtak;
    }
    const updatePayloadMovement: TreasuryMovementUpdate = {
      account_id: nextFields.account_id,
      movement_date: transaction.transaction_date,
      kind: nextFields.kind,
      quantity: nextFields.quantity,
      notes: transaction.description ?? null,
      ortak_movement_type: ortak,
      edited_by: userId,
      edited_time: now,
    };
    const { data: updatedMovement, error: mvError } = await supabase
      .from("treasury_movements")
      .update(updatePayloadMovement)
      .eq("id", existingMovement.id)
      .select()
      .single();
    if (mvError) throw mvError;
    movement = updatedMovement;
  } else if (!existingMovement && nextFields) {
    movement = await spawnMovementFromTransaction(transaction, userId, now);
  }

  return { transaction, movement };
}

export async function createExpenseType(
  name: string,
): Promise<ExpenseType> {
  const supabase = createClient();
  const payload: ExpenseTypeInsert = {
    name: name.trim(),
    is_active: true,
  };
  const { data, error } = await supabase
    .from("expense_types")
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function createPartner(name: string): Promise<Partner> {
  const supabase = createClient();
  const userId = await currentUserId();
  const now = new Date().toISOString();
  const payload: PartnerInsert = {
    name: name.trim(),
    created_by: userId,
    created_time: now,
    edited_by: userId,
    edited_time: now,
  };
  const { data, error } = await supabase
    .from("partners")
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}
