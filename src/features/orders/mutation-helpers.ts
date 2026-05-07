import { createClient } from "@/lib/supabase/client";
import { AUTH_DISABLED } from "@/lib/auth-mode";
import type {
  Order,
  OrderDetailInsert,
  Product,
} from "@/lib/supabase/types";

export async function currentUserId(): Promise<string | null> {
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

export async function loadOrder(orderId: string): Promise<Order> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .single();
  if (error) throw error;
  return data;
}

export function snapshotFromProduct(product: Product): Pick<
  OrderDetailInsert,
  | "product_name_snapshot"
  | "product_description_snapshot"
  | "product_photo_snapshot"
  | "unit_snapshot"
  | "cbm_per_unit_snapshot"
  | "weight_kg_per_unit_snapshot"
  | "packaging_type"
  | "package_length_cm"
  | "package_width_cm"
  | "package_height_cm"
  | "units_per_package"
  | "supplier_id"
> {
  return {
    product_name_snapshot: product.product_name ?? "",
    product_description_snapshot: product.client_description ?? null,
    product_photo_snapshot: product.product_image ?? null,
    unit_snapshot: product.unit ?? "",
    cbm_per_unit_snapshot: product.cbm_per_unit,
    weight_kg_per_unit_snapshot: product.weight_kg_per_unit,
    packaging_type: product.packaging_type,
    package_length_cm: product.package_length_cm,
    package_width_cm: product.package_width_cm,
    package_height_cm: product.package_height_cm,
    units_per_package: product.units_per_package,
    supplier_id: product.default_supplier ?? null,
  };
}

export async function fetchProductSnapshots(
  productIds: string[],
): Promise<Map<string, Product>> {
  if (productIds.length === 0) return new Map();
  const supabase = createClient();
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .in("product_id", productIds);
  if (error) throw error;
  const map = new Map<string, Product>();
  for (const p of data ?? []) map.set(p.product_id, p);
  return map;
}

export type CreateOrderLineInput = {
  product_id: string;
  quantity: number;
  unit_sales_price: number | null;
  est_purchase_unit_price: number | null;
  actual_purchase_price: number | null;
  vat_rate: number | null;
  supplier_id: string | null;
  notes: string | null;
  // Optional overrides — if omitted, snapshot values from product row are used.
  product_name_snapshot?: string | null;
  product_description_snapshot?: string | null;
  product_photo_snapshot?: string | null;
  unit_snapshot?: string | null;
  cbm_per_unit_snapshot?: number | null;
  weight_kg_per_unit_snapshot?: number | null;
  packaging_type?: string | null;
  package_length_cm?: number | null;
  package_width_cm?: number | null;
  package_height_cm?: number | null;
  units_per_package?: number | null;
};
