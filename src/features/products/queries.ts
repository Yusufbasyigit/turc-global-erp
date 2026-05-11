import { createClient } from "@/lib/supabase/client";
import { PRODUCT_IMAGE_BUCKET } from "@/lib/constants";
import type {
  Product,
  ProductCategory,
  ProductWithRelations,
  SupplierSummary,
} from "@/lib/supabase/types";

export function productImageUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  const supabase = createClient();
  const { data } = supabase.storage
    .from(PRODUCT_IMAGE_BUCKET)
    .getPublicUrl(path);
  return data.publicUrl;
}

export const productKeys = {
  all: ["products"] as const,
  list: () => [...productKeys.all, "list"] as const,
  detail: (id: string) => [...productKeys.all, "detail", id] as const,
};

export const productCategoryKeys = {
  all: ["product_categories"] as const,
};

export const supplierKeys = {
  all: ["suppliers"] as const,
};

const PRODUCT_SELECT = `
  *,
  product_categories:product_categories!products_category_id_fkey(id, name),
  supplier:contacts!products_default_supplier_fkey(id, company_name)
`;

export async function listProducts(): Promise<ProductWithRelations[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .is("deleted_at", null)
    .order("product_name", { ascending: true });

  if (error) throw error;
  return (data ?? []) as unknown as ProductWithRelations[];
}

export async function getProduct(
  id: string,
): Promise<ProductWithRelations | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("product_id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw error;
  return (data ?? null) as unknown as ProductWithRelations | null;
}

export async function listProductCategories(): Promise<ProductCategory[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("product_categories")
    .select("*")
    .order("name", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function listSupplierContacts(): Promise<SupplierSummary[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("contacts")
    .select("id, company_name")
    .eq("is_supplier", true)
    .is("deleted_at", null)
    .order("company_name", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export type { Product };
