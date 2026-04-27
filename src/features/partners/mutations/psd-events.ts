import { createClient } from "@/lib/supabase/client";
import { AUTH_DISABLED } from "@/lib/auth-mode";
import {
  spawnMovementFromTransaction,
} from "@/features/transactions/mutations";
import type {
  BalanceCurrency,
  PsdEvent,
  PsdEventInsert,
  PsdEventUpdate,
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

export type PsdLegInput = {
  id?: string;
  currency: BalanceCurrency;
  from_account_id: string;
  amount: number;
};

export type CreatePsdEventInput = {
  event_date: string;
  fiscal_period: string | null;
  note: string | null;
  legs: PsdLegInput[];
};

export type UpdatePsdEventInput = {
  id: string;
  event_date: string;
  fiscal_period: string | null;
  note: string | null;
  legs: PsdLegInput[];
};

function assertLegsValid(legs: PsdLegInput[]): void {
  if (legs.length === 0) {
    throw new Error("A PSD event must have at least one leg");
  }
  for (const leg of legs) {
    if (!leg.from_account_id) throw new Error("Each leg needs a source account");
    if (!leg.currency) throw new Error("Each leg needs a currency");
    if (!Number.isFinite(leg.amount) || leg.amount <= 0) {
      throw new Error("Each leg needs a positive amount");
    }
  }
}

async function deleteLegMovementAndTransaction(
  transactionId: string,
): Promise<void> {
  const supabase = createClient();
  // Movement is set null on transaction delete via FK ON DELETE SET NULL,
  // but we want it gone — drop the movement first, then the transaction.
  const { error: mvErr } = await supabase
    .from("treasury_movements")
    .delete()
    .eq("source_transaction_id", transactionId);
  if (mvErr) throw mvErr;
  const { error: txErr } = await supabase
    .from("transactions")
    .delete()
    .eq("id", transactionId);
  if (txErr) throw txErr;
}

async function insertLegWithMovement(
  eventId: string,
  leg: PsdLegInput,
  eventDate: string,
  note: string | null,
  userId: string | null,
  now: string,
): Promise<Transaction> {
  const supabase = createClient();
  const insert: TransactionInsert = {
    kind: "profit_distribution",
    transaction_date: eventDate,
    amount: leg.amount,
    currency: leg.currency,
    from_account_id: leg.from_account_id,
    to_account_id: null,
    contact_id: null,
    partner_id: null,
    psd_event_id: eventId,
    description: note,
    created_by: userId,
    created_time: now,
    edited_by: userId,
    edited_time: now,
  };
  const { data: txn, error } = await supabase
    .from("transactions")
    .insert(insert)
    .select()
    .single();
  if (error) throw error;

  try {
    await spawnMovementFromTransaction(txn, userId, now);
  } catch (err) {
    // Roll back the leg if the movement could not be created.
    await supabase.from("transactions").delete().eq("id", txn.id);
    throw err;
  }
  return txn;
}

export async function createPsdEvent(
  input: CreatePsdEventInput,
): Promise<{ event: PsdEvent; legs: Transaction[] }> {
  assertLegsValid(input.legs);
  const supabase = createClient();
  const userId = await currentUserId();
  const now = new Date().toISOString();

  const eventInsert: PsdEventInsert = {
    event_date: input.event_date,
    fiscal_period: input.fiscal_period,
    note: input.note,
    created_by: userId,
    created_time: now,
    edited_by: userId,
    edited_time: now,
  };
  const { data: event, error } = await supabase
    .from("psd_events")
    .insert(eventInsert)
    .select()
    .single();
  if (error) throw error;

  const legs: Transaction[] = [];
  try {
    for (const leg of input.legs) {
      const txn = await insertLegWithMovement(
        event.id,
        leg,
        input.event_date,
        input.note,
        userId,
        now,
      );
      legs.push(txn);
    }
  } catch (err) {
    // Roll back the whole event.
    for (const txn of legs) {
      await deleteLegMovementAndTransaction(txn.id).catch(() => {});
    }
    await supabase.from("psd_events").delete().eq("id", event.id);
    throw err;
  }

  return { event, legs };
}

export async function updatePsdEvent(
  input: UpdatePsdEventInput,
): Promise<{ event: PsdEvent; legs: Transaction[] }> {
  assertLegsValid(input.legs);
  const supabase = createClient();
  const userId = await currentUserId();
  const now = new Date().toISOString();

  const update: PsdEventUpdate = {
    event_date: input.event_date,
    fiscal_period: input.fiscal_period,
    note: input.note,
    edited_by: userId,
    edited_time: now,
  };
  const { data: event, error } = await supabase
    .from("psd_events")
    .update(update)
    .eq("id", input.id)
    .select()
    .single();
  if (error) throw error;

  // Reconcile legs: delete any existing leg whose id is not in the input,
  // update kept legs, insert new legs.
  const { data: existingLegs, error: legsErr } = await supabase
    .from("transactions")
    .select("*")
    .eq("psd_event_id", event.id);
  if (legsErr) throw legsErr;
  const existing = (existingLegs ?? []) as Transaction[];

  const incomingIds = new Set(input.legs.filter((l) => l.id).map((l) => l.id!));
  const toDelete = existing.filter((e) => !incomingIds.has(e.id));

  for (const old of toDelete) {
    await deleteLegMovementAndTransaction(old.id);
  }

  const finalLegs: Transaction[] = [];
  for (const leg of input.legs) {
    if (leg.id) {
      // Update existing leg: amount/currency/from_account/date may change.
      const legUpdate: TransactionUpdate = {
        transaction_date: input.event_date,
        amount: leg.amount,
        currency: leg.currency,
        from_account_id: leg.from_account_id,
        description: input.note,
        edited_by: userId,
        edited_time: now,
      };
      const { data: updated, error: updErr } = await supabase
        .from("transactions")
        .update(legUpdate)
        .eq("id", leg.id)
        .select()
        .single();
      if (updErr) throw updErr;

      // Refresh the linked treasury_movement to mirror the new amount/account/date.
      const { error: mvErr } = await supabase
        .from("treasury_movements")
        .update({
          account_id: leg.from_account_id,
          movement_date: input.event_date,
          quantity: -Math.abs(leg.amount),
          notes: input.note,
          edited_by: userId,
          edited_time: now,
        })
        .eq("source_transaction_id", updated.id);
      if (mvErr) throw mvErr;

      finalLegs.push(updated);
    } else {
      const txn = await insertLegWithMovement(
        event.id,
        leg,
        input.event_date,
        input.note,
        userId,
        now,
      );
      finalLegs.push(txn);
    }
  }

  return { event, legs: finalLegs };
}

export async function deletePsdEvent(id: string): Promise<void> {
  const supabase = createClient();

  // Manually clear movements first — the FK uses ON DELETE SET NULL on
  // source_transaction_id, but we want to remove the withdraw movements too.
  const { data: legs, error: legsErr } = await supabase
    .from("transactions")
    .select("id")
    .eq("psd_event_id", id);
  if (legsErr) throw legsErr;

  for (const leg of legs ?? []) {
    await deleteLegMovementAndTransaction(leg.id);
  }

  const { error } = await supabase.from("psd_events").delete().eq("id", id);
  if (error) throw error;
}
