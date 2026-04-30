import { createClient } from "@/lib/supabase/client";
import { AUTH_DISABLED } from "@/lib/auth-mode";
import type { CustodyLocation } from "@/lib/supabase/types";
import type {
  AppSettingsFormValues,
  CustodyLocationFormValues,
} from "./schema";

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

export async function updateAppSettings(
  values: AppSettingsFormValues,
): Promise<void> {
  const supabase = createClient();
  const userId = await currentUserId();

  const { error } = await supabase
    .from("app_settings")
    // Use loose typing here — `app_settings` won't appear in the generated
    // Database type until `npm run db:types` runs after the migration.
    .update({
      company_name: values.company_name,
      address_line1: values.address_line1,
      address_line2: values.address_line2,
      phone: values.phone,
      email: values.email,
      updated_time: new Date().toISOString(),
      updated_by: userId,
    } as never)
    .eq("id", true as never);

  if (error) throw error;
}

export async function createCustodyLocation(
  values: CustodyLocationFormValues,
): Promise<CustodyLocation> {
  const supabase = createClient();
  const userId = await currentUserId();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("custody_locations")
    .insert({
      name: values.name,
      location_type: values.location_type,
      requires_movement_type: values.requires_movement_type,
      is_active: true,
      created_by: userId,
      created_time: now,
      edited_by: userId,
      edited_time: now,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateCustodyLocation(
  id: string,
  values: CustodyLocationFormValues,
): Promise<CustodyLocation> {
  const supabase = createClient();
  const userId = await currentUserId();

  const { data, error } = await supabase
    .from("custody_locations")
    .update({
      name: values.name,
      location_type: values.location_type,
      requires_movement_type: values.requires_movement_type,
      edited_by: userId,
      edited_time: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function setCustodyLocationActive(
  id: string,
  isActive: boolean,
): Promise<CustodyLocation> {
  const supabase = createClient();
  const userId = await currentUserId();

  const { data, error } = await supabase
    .from("custody_locations")
    .update({
      is_active: isActive,
      edited_by: userId,
      edited_time: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}
