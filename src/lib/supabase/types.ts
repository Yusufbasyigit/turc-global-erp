import type { Database } from "@/types/database";

type PublicTable<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T];

export type Contact = PublicTable<"contacts">["Row"];
export type ContactInsert = PublicTable<"contacts">["Insert"];
export type ContactUpdate = PublicTable<"contacts">["Update"];

export type ContactNote = PublicTable<"contact_notes">["Row"];
export type ContactNoteInsert = PublicTable<"contact_notes">["Insert"];

export type Country = PublicTable<"countries">["Row"];

export const CONTACT_TYPES = [
  "customer",
  "supplier",
  "logistics",
  "other",
] as const;
export type ContactType = (typeof CONTACT_TYPES)[number];

export const BALANCE_CURRENCIES = ["TRY", "EUR", "USD", "GBP"] as const;
export type BalanceCurrency = (typeof BALANCE_CURRENCIES)[number];

export type ContactWithCountry = Contact & {
  countries: Pick<Country, "code" | "name_en" | "flag_emoji"> | null;
};
