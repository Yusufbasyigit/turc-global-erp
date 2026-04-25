import { createClient } from "@/lib/supabase/client";
import { AUTH_DISABLED } from "@/lib/auth-mode";
import type {
  Partner,
  PartnerInsert,
  PartnerUpdate,
} from "@/lib/supabase/types";
import type { PartnerFormOutput } from "./schema";

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

export async function createPartner(
  values: PartnerFormOutput,
): Promise<Partner> {
  const supabase = createClient();
  const userId = await currentUserId();
  const now = new Date().toISOString();

  const payload: PartnerInsert = {
    name: values.name,
    is_active: true,
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

export async function renamePartner(
  id: string,
  values: PartnerFormOutput,
): Promise<Partner> {
  const supabase = createClient();
  const userId = await currentUserId();

  const payload: PartnerUpdate = {
    name: values.name,
    edited_by: userId,
    edited_time: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("partners")
    .update(payload)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function setPartnerActive(
  id: string,
  isActive: boolean,
): Promise<Partner> {
  const supabase = createClient();
  const userId = await currentUserId();

  const payload: PartnerUpdate = {
    is_active: isActive,
    edited_by: userId,
    edited_time: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("partners")
    .update(payload)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function softDeletePartner(id: string): Promise<void> {
  const supabase = createClient();
  const userId = await currentUserId();
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("partners")
    .update({
      deleted_at: now,
      edited_by: userId,
      edited_time: now,
    })
    .eq("id", id);

  if (error) throw error;
}

export async function restorePartner(id: string): Promise<void> {
  const supabase = createClient();
  const userId = await currentUserId();
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("partners")
    .update({
      deleted_at: null,
      edited_by: userId,
      edited_time: now,
    })
    .eq("id", id);

  if (error) throw error;
}
