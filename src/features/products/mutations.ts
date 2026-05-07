import { createClient } from "@/lib/supabase/client";
import { AUTH_DISABLED } from "@/lib/auth-mode";
import { PRODUCT_IMAGE_BUCKET } from "@/lib/constants";
import type {
  Product,
  ProductCategory,
  ProductCategoryInsert,
  ProductInsert,
  ProductUpdate,
} from "@/lib/supabase/types";
import type { ProductFormOutput } from "./schema";

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

function toPayload(
  values: ProductFormOutput,
): Omit<
  ProductInsert,
  | "product_id"
  | "created_by"
  | "created_time"
  | "edited_by"
  | "edited_time"
  | "deleted_at"
> {
  const emptyToNull = (v: string | undefined | null) =>
    v && v.trim().length > 0 ? v.trim() : null;

  const packagingType = values.packaging_type ?? null;
  const hasPackaging = !!packagingType;

  return {
    product_name: values.product_name.trim(),
    client_product_name: emptyToNull(values.client_product_name),
    client_description: emptyToNull(values.client_description),
    barcode_value: emptyToNull(values.barcode_value),
    hs_code: emptyToNull(values.hs_code),
    category_id: values.category_id ?? null,
    default_supplier: values.default_supplier ?? null,
    unit: emptyToNull(values.unit),
    is_active: values.is_active,
    product_image: emptyToNull(values.product_image),
    est_purchase_price: values.est_purchase_price ?? null,
    est_currency: values.est_currency ?? null,
    default_sales_price: values.default_sales_price ?? null,
    sales_currency: values.sales_currency ?? null,
    kdv_rate: values.kdv_rate ?? null,
    cbm_per_unit: values.cbm_per_unit ?? null,
    weight_kg_per_unit: values.weight_kg_per_unit ?? null,
    packaging_type: packagingType,
    package_length_cm: hasPackaging ? values.package_length_cm ?? null : null,
    package_width_cm: hasPackaging ? values.package_width_cm ?? null : null,
    package_height_cm: hasPackaging ? values.package_height_cm ?? null : null,
    units_per_package: hasPackaging ? values.units_per_package ?? null : null,
  };
}

export async function createProduct(
  values: ProductFormOutput,
  productId: string,
): Promise<Product> {
  const supabase = createClient();
  const userId = await currentUserId();
  const now = new Date().toISOString();

  const payload: ProductInsert = {
    ...toPayload(values),
    product_id: productId,
    created_by: userId,
    created_time: now,
    edited_by: userId,
    edited_time: now,
  };

  const { data, error } = await supabase
    .from("products")
    .insert(payload)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateProduct(
  id: string,
  values: ProductFormOutput,
): Promise<Product> {
  const supabase = createClient();
  const userId = await currentUserId();

  const payload: ProductUpdate = {
    ...toPayload(values),
    edited_by: userId,
    edited_time: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("products")
    .update(payload)
    .eq("product_id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteProduct(id: string): Promise<void> {
  const supabase = createClient();
  const userId = await currentUserId();
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("products")
    .update({
      deleted_at: now,
      edited_by: userId,
      edited_time: now,
    })
    .eq("product_id", id);

  if (error) throw error;
}

export async function createProductCategory(
  name: string,
): Promise<ProductCategory> {
  const supabase = createClient();
  const userId = await currentUserId();
  const now = new Date().toISOString();

  const payload: ProductCategoryInsert = {
    name: name.trim(),
    created_by: userId,
    created_time: now,
    edited_by: userId,
    edited_time: now,
  };

  const { data, error } = await supabase
    .from("product_categories")
    .insert(payload)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function uploadProductImage(
  productId: string,
  file: File,
): Promise<string> {
  const supabase = createClient();
  const extMatch = file.name.match(/\.([a-zA-Z0-9]+)$/);
  const ext = extMatch ? extMatch[1].toLowerCase() : "jpg";
  const path = `${productId}/${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from(PRODUCT_IMAGE_BUCKET)
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type,
    });

  if (error) throw error;
  return path;
}

export async function deleteProductImage(path: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.storage
    .from(PRODUCT_IMAGE_BUCKET)
    .remove([path]);
  if (error) throw error;
}
