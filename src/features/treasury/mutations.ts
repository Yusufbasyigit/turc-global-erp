import { createClient } from "@/lib/supabase/client";
import { AUTH_DISABLED } from "@/lib/auth-mode";
import type {
  Account,
  AccountInsert,
  MovementKind,
  OrtakMovementType,
  TreasuryMovement,
  TreasuryMovementInsert,
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

export function signedQuantityFor(kind: MovementKind, q: number): number {
  if (kind === "withdraw") return -Math.abs(q);
  if (kind === "deposit" || kind === "opening") return Math.abs(q);
  return q;
}

export async function createAccountWithOpening(input: {
  account_name: string;
  asset_code: string;
  asset_type: string;
  custody_location_id: string;
  quantity: number;
  movement_date: string;
  notes?: string | null;
  ortak_movement_type?: OrtakMovementType | null;
}): Promise<{ account: Account; movement: TreasuryMovement }> {
  const supabase = createClient();
  const userId = await currentUserId();
  const now = new Date().toISOString();

  const accountId = crypto.randomUUID();

  const accountPayload: AccountInsert = {
    id: accountId,
    account_name: input.account_name,
    asset_code: input.asset_code,
    asset_type: input.asset_type,
    custody_location_id: input.custody_location_id,
    created_by: userId,
    created_time: now,
    edited_by: userId,
    edited_time: now,
  };

  const { data: account, error: accountError } = await supabase
    .from("accounts")
    .insert(accountPayload)
    .select()
    .single();
  if (accountError) throw accountError;

  const movementPayload: TreasuryMovementInsert = {
    account_id: accountId,
    movement_date: input.movement_date,
    kind: "opening",
    quantity: Math.abs(input.quantity),
    notes: input.notes?.trim() ? input.notes.trim() : null,
    ortak_movement_type: input.ortak_movement_type ?? null,
    created_by: userId,
    created_time: now,
  };

  const { data: movement, error: movementError } = await supabase
    .from("treasury_movements")
    .insert(movementPayload)
    .select()
    .single();

  if (movementError) {
    await supabase.from("accounts").delete().eq("id", accountId);
    throw movementError;
  }

  return { account, movement };
}

export async function createSingleLegMovement(input: {
  account_id: string;
  kind: Exclude<MovementKind, "transfer" | "trade">;
  quantity: number;
  movement_date: string;
  notes?: string | null;
  ortak_movement_type?: OrtakMovementType | null;
}): Promise<TreasuryMovement> {
  const supabase = createClient();
  const userId = await currentUserId();

  const payload: TreasuryMovementInsert = {
    account_id: input.account_id,
    movement_date: input.movement_date,
    kind: input.kind,
    quantity: signedQuantityFor(input.kind, input.quantity),
    notes: input.notes?.trim() ? input.notes.trim() : null,
    ortak_movement_type: input.ortak_movement_type ?? null,
    created_by: userId,
    created_time: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("treasury_movements")
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function createPairedMovement(input: {
  kind: "transfer" | "trade";
  from_account_id: string;
  to_account_id: string;
  quantity_from: number;
  quantity_to: number;
  movement_date: string;
  notes?: string | null;
  ortak_movement_type?: OrtakMovementType | null;
}): Promise<TreasuryMovement[]> {
  const supabase = createClient();
  const userId = await currentUserId();
  const groupId = crypto.randomUUID();
  const now = new Date().toISOString();
  const cleanNotes = input.notes?.trim() ? input.notes.trim() : null;

  const rows: TreasuryMovementInsert[] = [
    {
      account_id: input.from_account_id,
      movement_date: input.movement_date,
      kind: input.kind,
      quantity: -Math.abs(input.quantity_from),
      group_id: groupId,
      notes: cleanNotes,
      ortak_movement_type: input.ortak_movement_type ?? null,
      created_by: userId,
      created_time: now,
    },
    {
      account_id: input.to_account_id,
      movement_date: input.movement_date,
      kind: input.kind,
      quantity: Math.abs(input.quantity_to),
      group_id: groupId,
      notes: cleanNotes,
      ortak_movement_type: input.ortak_movement_type ?? null,
      created_by: userId,
      created_time: now,
    },
  ];

  const { data, error } = await supabase
    .from("treasury_movements")
    .insert(rows)
    .select();
  if (error) throw error;
  return data ?? [];
}

