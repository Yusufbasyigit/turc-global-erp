import { createClient } from "@/lib/supabase/client";
import { AUTH_DISABLED } from "@/lib/auth-mode";
import type {
  Account,
  AccountInsert,
  FxSnapshot,
  MovementKind,
  OrtakMovementType,
  PriceSnapshot,
  TreasuryMovement,
  TreasuryMovementInsert,
} from "@/lib/supabase/types";
import { latestByKey } from "./queries";
import {
  checkTradePlausibility,
  formatTradePlausibilityError,
} from "./trade-plausibility";

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

  // A "transfer" moves the same asset between custody locations, so both
  // legs must hold matching currencies and quantities. Without this guard,
  // a USD→EUR transfer silently corrupts SUM(quantity) on both accounts.
  // "trade" intentionally crosses assets, so the same guard does not apply —
  // instead, the trade branch below runs a soft plausibility check against
  // the latest rate snapshots to catch typos like 100/1 instead of 1000/1.
  if (input.kind === "transfer") {
    const { data: accts, error: acctErr } = await supabase
      .from("accounts")
      .select("id, asset_code")
      .in("id", [input.from_account_id, input.to_account_id]);
    if (acctErr) throw acctErr;
    const from = accts?.find((a) => a.id === input.from_account_id);
    const to = accts?.find((a) => a.id === input.to_account_id);
    if (!from || !to) throw new Error("Account not found");
    if (from.asset_code !== to.asset_code) {
      throw new Error(
        `Transfer requires matching currencies — from holds ${from.asset_code}, to holds ${to.asset_code}. Use a trade for cross-asset moves.`,
      );
    }
    if (Math.abs(input.quantity_from) !== Math.abs(input.quantity_to)) {
      throw new Error("Transfer quantities must match (same asset).");
    }
  } else if (input.kind === "trade") {
    const { data: accts, error: acctErr } = await supabase
      .from("accounts")
      .select("id, asset_code, asset_type")
      .in("id", [input.from_account_id, input.to_account_id]);
    if (acctErr) throw acctErr;
    const from = accts?.find((a) => a.id === input.from_account_id);
    const to = accts?.find((a) => a.id === input.to_account_id);
    if (!from || !to) throw new Error("Account not found");

    const [{ data: fxRows, error: fxErr }, { data: priceRows, error: priceErr }] =
      await Promise.all([
        supabase.from("fx_snapshots").select("*"),
        supabase.from("price_snapshots").select("*"),
      ]);
    if (fxErr) throw fxErr;
    if (priceErr) throw priceErr;
    const fxMap = latestByKey(
      (fxRows ?? []) as FxSnapshot[],
      (r) => r.currency_code.toUpperCase(),
      (r) => r.fetched_at,
    );
    const priceMap = latestByKey(
      (priceRows ?? []) as PriceSnapshot[],
      (r) => r.asset_code,
      (r) => r.snapshot_date,
    );

    const verdict = checkTradePlausibility({
      from: { asset_code: from.asset_code, asset_type: from.asset_type },
      to: { asset_code: to.asset_code, asset_type: to.asset_type },
      quantityFrom: input.quantity_from,
      quantityTo: input.quantity_to,
      fxMap,
      priceMap,
    });
    if (verdict.status === "blocked") {
      throw new Error(
        formatTradePlausibilityError({
          from: { asset_code: from.asset_code, asset_type: from.asset_type },
          to: { asset_code: to.asset_code, asset_type: to.asset_type },
          impliedRate: verdict.impliedRate,
          expectedRate: verdict.expectedRate,
          divergence: verdict.divergence,
        }),
      );
    }
  }

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

