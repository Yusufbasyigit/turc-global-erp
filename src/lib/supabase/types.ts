import type { Database } from "@/types/database";

type PublicTable<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T];

export type Contact = PublicTable<"contacts">["Row"];
export type ContactInsert = PublicTable<"contacts">["Insert"];
export type ContactUpdate = PublicTable<"contacts">["Update"];

export type ContactNote = PublicTable<"contact_notes">["Row"];
export type ContactNoteInsert = PublicTable<"contact_notes">["Insert"];

export type Country = PublicTable<"countries">["Row"];

export type Product = PublicTable<"products">["Row"];
export type ProductInsert = PublicTable<"products">["Insert"];
export type ProductUpdate = PublicTable<"products">["Update"];

export type ProductCategory = PublicTable<"product_categories">["Row"];
export type ProductCategoryInsert = PublicTable<"product_categories">["Insert"];

export const CONTACT_TYPES = [
  "customer",
  "supplier",
  "logistics",
  "other",
] as const;
export type ContactType = (typeof CONTACT_TYPES)[number];

export const BALANCE_CURRENCIES = ["TRY", "EUR", "USD", "GBP"] as const;
export type BalanceCurrency = (typeof BALANCE_CURRENCIES)[number];

export const PACKAGING_TYPES = [
  "box",
  "pallet",
  "carton",
  "bag",
  "other",
] as const;
export type PackagingType = (typeof PACKAGING_TYPES)[number];

export const KDV_RATES = [0, 1, 10, 20] as const;
export type KdvRate = (typeof KDV_RATES)[number];

export type ContactWithCountry = Contact & {
  countries: Pick<Country, "code" | "name_en" | "flag_emoji"> | null;
};

export type SupplierSummary = Pick<Contact, "id" | "company_name">;

export type ProductWithRelations = Product & {
  product_categories: Pick<ProductCategory, "id" | "name"> | null;
  supplier: SupplierSummary | null;
};
