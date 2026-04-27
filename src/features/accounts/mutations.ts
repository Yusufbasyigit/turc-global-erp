import { createClient } from "@/lib/supabase/client";
import { AUTH_DISABLED } from "@/lib/auth-mode";
import type {
  Account,
  AccountInsert,
  AccountUpdate,
} from "@/lib/supabase/types";
import type { AccountFormOutput } from "./schema";

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

// Strip fields that don't apply to the chosen asset_type so the row stays
// tidy. The form already hides these inputs; this is a defensive backstop.
function shapeForAssetType(values: AccountFormOutput) {
  const isFiat = values.asset_type === "fiat";
  const isFund = values.asset_type === "fund";
  return {
    bank_name: isFiat ? (values.bank_name ?? null) : null,
    iban: isFiat ? (values.iban ?? null) : null,
    account_type: isFiat ? (values.account_type ?? null) : null,
    subtype: isFund ? (values.subtype ?? null) : null,
  };
}

export async function createAccount(
  values: AccountFormOutput,
): Promise<Account> {
  const supabase = createClient();
  const userId = await currentUserId();
  const now = new Date().toISOString();

  const payload: AccountInsert = {
    account_name: values.account_name,
    asset_type: values.asset_type,
    asset_code: values.asset_code,
    custody_location_id: values.custody_location_id,
    is_active: true,
    deleted_at: null,
    ...shapeForAssetType(values),
    created_by: userId,
    created_time: now,
    edited_by: userId,
    edited_time: now,
  };

  const { data, error } = await supabase
    .from("accounts")
    .insert(payload)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Updates everything except asset_type — the form disables that field, but
// keep this defensive in case someone bypasses the UI.
export async function updateAccount(
  id: string,
  values: AccountFormOutput,
): Promise<Account> {
  const supabase = createClient();
  const userId = await currentUserId();

  const payload: AccountUpdate = {
    account_name: values.account_name,
    asset_code: values.asset_code,
    custody_location_id: values.custody_location_id,
    ...shapeForAssetType(values),
    edited_by: userId,
    edited_time: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("accounts")
    .update(payload)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function setAccountActive(
  id: string,
  isActive: boolean,
): Promise<Account> {
  const supabase = createClient();
  const userId = await currentUserId();

  const payload: AccountUpdate = {
    is_active: isActive,
    edited_by: userId,
    edited_time: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("accounts")
    .update(payload)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function softDeleteAccount(id: string): Promise<void> {
  const supabase = createClient();
  const userId = await currentUserId();
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("accounts")
    .update({
      deleted_at: now,
      edited_by: userId,
      edited_time: now,
    })
    .eq("id", id);

  if (error) throw error;
}

export async function restoreAccount(id: string): Promise<void> {
  const supabase = createClient();
  const userId = await currentUserId();
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("accounts")
    .update({
      deleted_at: null,
      edited_by: userId,
      edited_time: now,
    })
    .eq("id", id);

  if (error) throw error;
}
