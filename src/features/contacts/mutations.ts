import { createClient } from "@/lib/supabase/client";
import { AUTH_DISABLED } from "@/lib/auth-mode";
import type {
  Contact,
  ContactInsert,
  ContactNote,
  ContactNoteInsert,
  ContactUpdate,
} from "@/lib/supabase/types";
import type { ContactFormOutput, ContactNoteFormValues } from "./schema";

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

function toPayload(values: ContactFormOutput): Omit<
  ContactInsert,
  "id" | "created_by" | "created_time" | "edited_by" | "edited_time"
> {
  const isTurkey = values.country_code === "TR";
  const emptyToNull = (v: string | undefined) =>
    v && v.trim().length > 0 ? v.trim() : null;

  return {
    company_name: values.company_name.trim(),
    contact_person: emptyToNull(values.contact_person),
    type: values.type,
    phone: emptyToNull(values.phone),
    email: emptyToNull(values.email),
    address: emptyToNull(values.address),
    city: emptyToNull(values.city),
    country_code: emptyToNull(values.country_code),
    balance_currency: values.balance_currency ?? null,
    tax_id: emptyToNull(values.tax_id),
    tax_office: isTurkey ? emptyToNull(values.tax_office) : null,
    notes: values.notes && values.notes.trim().length > 0 ? values.notes : null,
  };
}

export async function createContact(values: ContactFormOutput): Promise<Contact> {
  const supabase = createClient();
  const userId = await currentUserId();
  const now = new Date().toISOString();

  const payload: ContactInsert = {
    ...toPayload(values),
    created_by: userId,
    created_time: now,
    edited_by: userId,
    edited_time: now,
  };

  const { data, error } = await supabase
    .from("contacts")
    .insert(payload)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateContact(
  id: string,
  values: ContactFormOutput,
): Promise<Contact> {
  const supabase = createClient();
  const userId = await currentUserId();

  const payload: ContactUpdate = {
    ...toPayload(values),
    edited_by: userId,
    edited_time: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("contacts")
    .update(payload)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteContact(id: string): Promise<void> {
  const supabase = createClient();
  const userId = await currentUserId();
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("contacts")
    .update({
      deleted_at: now,
      edited_by: userId,
      edited_time: now,
    })
    .eq("id", id);

  if (error) throw error;
}

export async function addContactNote(
  contactId: string,
  values: ContactNoteFormValues,
): Promise<ContactNote> {
  const supabase = createClient();
  const userId = await currentUserId();

  const payload: ContactNoteInsert = {
    contact_id: contactId,
    body: values.body.trim(),
    note_date: values.note_date,
    created_by: userId,
    created_time: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("contact_notes")
    .insert(payload)
    .select()
    .single();

  if (error) throw error;
  return data;
}
