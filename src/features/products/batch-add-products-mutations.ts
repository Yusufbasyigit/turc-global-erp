import { createClient } from "@/lib/supabase/client";
import { AUTH_DISABLED } from "@/lib/auth-mode";
import type { ProductInsert } from "@/lib/supabase/types";

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

export type BatchProductInput = {
  product_name: string;
  client_product_name: string | null;
  client_description: string | null;
  barcode_value: string | null;
  unit: string | null;
  est_purchase_price: number | null;
  est_currency: string | null;
  default_sales_price: number | null;
  sales_currency: string | null;
  kdv_rate: number | null;
  weight_kg_per_unit: number | null;
  cbm_per_unit: number | null;
  hs_code: string | null;
};

export async function batchAddProducts(args: {
  products: BatchProductInput[];
  defaultSupplierId: string | null;
}): Promise<{ count: number }> {
  const { products, defaultSupplierId } = args;
  if (products.length === 0) return { count: 0 };

  const supabase = createClient();
  const userId = await currentUserId();
  const now = new Date().toISOString();

  const createdProductIds: string[] = [];

  try {
    for (let i = 0; i < products.length; i++) {
      const p = products[i];
      const productId =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${i}-${Math.random().toString(36).slice(2)}`;

      const payload: ProductInsert = {
        product_id: productId,
        product_name: p.product_name.trim(),
        client_product_name: p.client_product_name?.trim() || null,
        client_description: p.client_description?.trim() || null,
        barcode_value: p.barcode_value?.trim() || null,
        unit: p.unit?.trim() || null,
        est_purchase_price: p.est_purchase_price,
        est_currency: p.est_currency,
        default_sales_price: p.default_sales_price,
        sales_currency: p.sales_currency,
        kdv_rate: p.kdv_rate,
        weight_kg_per_unit: p.weight_kg_per_unit,
        cbm_per_unit: p.cbm_per_unit,
        hs_code: p.hs_code?.trim() || null,
        category_id: null,
        default_supplier: defaultSupplierId,
        product_image: null,
        packaging_type: null,
        package_length_cm: null,
        package_width_cm: null,
        package_height_cm: null,
        units_per_package: null,
        is_active: true,
        created_by: userId,
        created_time: now,
        edited_by: userId,
        edited_time: now,
      };

      const { data: row, error } = await supabase
        .from("products")
        .insert(payload)
        .select("product_id")
        .single();
      if (error) throw error;
      createdProductIds.push(row.product_id);
    }

    return { count: products.length };
  } catch (err) {
    await rollbackBatch(supabase, createdProductIds);
    throw err;
  }
}

async function rollbackBatch(
  supabase: ReturnType<typeof createClient>,
  createdProductIds: string[],
): Promise<void> {
  if (createdProductIds.length === 0) return;
  try {
    await supabase.from("products").delete().in("product_id", createdProductIds);
  } catch {
    /* best-effort rollback */
  }
}
