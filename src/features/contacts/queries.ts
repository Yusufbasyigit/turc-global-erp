import { createClient } from "@/lib/supabase/client";
import type {
  Contact,
  ContactNote,
  ContactWithCountry,
  Country,
} from "@/lib/supabase/types";

export const contactKeys = {
  all: ["contacts"] as const,
  list: () => [...contactKeys.all, "list"] as const,
  detail: (id: string) => [...contactKeys.all, "detail", id] as const,
  notes: (id: string) => [...contactKeys.all, "notes", id] as const,
};

export const countryKeys = {
  all: ["countries"] as const,
};

export async function listContacts(): Promise<ContactWithCountry[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("contacts")
    .select("*, countries(code, name_en, flag_emoji)")
    .is("deleted_at", null)
    .order("company_name", { ascending: true });

  if (error) throw error;
  return (data ?? []) as ContactWithCountry[];
}

export async function getContact(id: string): Promise<ContactWithCountry | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("contacts")
    .select("*, countries(code, name_en, flag_emoji)")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw error;
  return (data ?? null) as ContactWithCountry | null;
}

export async function listCountries(): Promise<Country[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("countries")
    .select("*")
    .order("name_en", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function listContactNotes(contactId: string): Promise<ContactNote[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("contact_notes")
    .select("*")
    .eq("contact_id", contactId)
    .order("note_date", { ascending: false })
    .order("created_time", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export type { Contact };
