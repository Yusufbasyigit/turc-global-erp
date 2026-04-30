import { createClient } from "@/lib/supabase/client";
import { AUTH_DISABLED } from "@/lib/auth-mode";
import type {
  OrderDetailInsert,
  Product,
  ProductInsert,
} from "@/lib/supabase/types";
import { notesFromLine } from "./proforma-helpers";
import { snapshotFromProduct } from "./mutations";
import {
  assertShipmentEditable,
  refreshShipmentBilling,
} from "@/features/shipments/billing";

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

export type BatchLineInput = {
  proposed_product_name: string;
  primary_quantity: number;
  primary_unit: string;
  unit_price: number;
  line_currency?: string | null;
  hs_code?: string | null;
  supplier_sku?: string | null;
  secondary_quantities?: Record<string, number> | null;
  notes?: string | null;
};

export async function batchAddLinesFromProforma(args: {
  orderId: string;
  lines: BatchLineInput[];
  fallbackCurrency: string;
}): Promise<{ count: number }> {
  const { orderId, lines, fallbackCurrency } = args;
  if (lines.length === 0) return { count: 0 };

  const supabase = createClient();
  const userId = await currentUserId();
  const now = new Date().toISOString();

  const { data: orderRow, error: orderErr } = await supabase
    .from("orders")
    .select("billing_shipment_id")
    .eq("id", orderId)
    .single();
  if (orderErr) throw orderErr;
  const billingShipmentId = orderRow?.billing_shipment_id ?? null;
  await assertShipmentEditable(billingShipmentId);

  const { data: existing, error: countErr } = await supabase
    .from("order_details")
    .select("line_number")
    .eq("order_id", orderId)
    .order("line_number", { ascending: false })
    .limit(1);
  if (countErr) throw countErr;
  const startLine = existing?.[0]?.line_number ?? 0;

  const trimmedNames = lines
    .map((l) => l.proposed_product_name.trim())
    .filter((n) => n.length > 0);
  const existingByLowerName = new Map<string, Product>();
  if (trimmedNames.length > 0) {
    const { data: matches, error: matchErr } = await supabase
      .from("products")
      .select("*")
      .in("product_name", trimmedNames)
      .eq("is_active", true);
    if (matchErr) throw matchErr;
    for (const p of matches ?? []) {
      const key = (p.product_name ?? "").trim().toLowerCase();
      if (!key) continue;
      const prev = existingByLowerName.get(key);
      if (
        !prev ||
        (p.created_time ?? "") > (prev.created_time ?? "")
      ) {
        existingByLowerName.set(key, p);
      }
    }
  }

  const createdProductIds: string[] = [];
  const createdDetailIds: string[] = [];

  try {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedName = line.proposed_product_name.trim();
      const matched = existingByLowerName.get(trimmedName.toLowerCase()) ?? null;

      let productId: string;
      let snap: ReturnType<typeof snapshotFromProduct> | null = null;

      if (matched) {
        productId = matched.product_id;
        snap = snapshotFromProduct(matched);
      } else {
        productId =
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `${Date.now()}-${i}-${Math.random().toString(36).slice(2)}`;

        const productPayload: ProductInsert = {
          product_id: productId,
          product_name: trimmedName,
          unit: line.primary_unit.trim() || null,
          est_purchase_price: line.unit_price,
          est_currency: (line.line_currency || fallbackCurrency) ?? null,
          hs_code:
            line.hs_code && line.hs_code.trim() ? line.hs_code.trim() : null,
          is_active: true,
          created_by: userId,
          created_time: now,
          edited_by: userId,
          edited_time: now,
        };

        const { data: productRow, error: productErr } = await supabase
          .from("products")
          .insert(productPayload)
          .select("product_id")
          .single();
        if (productErr) throw productErr;
        createdProductIds.push(productRow.product_id);
        productId = productRow.product_id;
      }

      const detailPayload: OrderDetailInsert = {
        order_id: orderId,
        product_id: productId,
        line_number: startLine + i + 1,
        product_name_snapshot:
          snap?.product_name_snapshot || trimmedName,
        product_description_snapshot:
          snap?.product_description_snapshot ?? null,
        product_photo_snapshot: snap?.product_photo_snapshot ?? null,
        unit_snapshot:
          snap?.unit_snapshot || line.primary_unit.trim() || "",
        cbm_per_unit_snapshot: snap?.cbm_per_unit_snapshot ?? null,
        weight_kg_per_unit_snapshot: snap?.weight_kg_per_unit_snapshot ?? null,
        packaging_type: snap?.packaging_type ?? null,
        package_length_cm: snap?.package_length_cm ?? null,
        package_width_cm: snap?.package_width_cm ?? null,
        package_height_cm: snap?.package_height_cm ?? null,
        units_per_package: snap?.units_per_package ?? null,
        quantity: line.primary_quantity,
        unit_sales_price: null,
        est_purchase_unit_price: line.unit_price,
        actual_purchase_price: null,
        vat_rate: null,
        supplier_id: snap?.supplier_id ?? null,
        notes: notesFromLine(line),
        created_by: userId,
        created_time: now,
        edited_by: userId,
        edited_time: now,
      };

      const { data: detailRow, error: detailErr } = await supabase
        .from("order_details")
        .insert(detailPayload)
        .select("id")
        .single();
      if (detailErr) throw detailErr;
      createdDetailIds.push(detailRow.id);
    }

    if (billingShipmentId) {
      try {
        await refreshShipmentBilling(billingShipmentId);
      } catch (refreshErr) {
        await rollbackBatch(supabase, createdDetailIds, createdProductIds);
        throw refreshErr;
      }
    }

    return { count: lines.length };
  } catch (err) {
    await rollbackBatch(supabase, createdDetailIds, createdProductIds);
    throw err;
  }
}

async function rollbackBatch(
  supabase: ReturnType<typeof createClient>,
  createdDetailIds: string[],
  createdProductIds: string[],
): Promise<void> {
  if (createdDetailIds.length > 0) {
    try {
      await supabase
        .from("order_details")
        .delete()
        .in("id", createdDetailIds);
    } catch {
      /* best-effort rollback */
    }
  }
  if (createdProductIds.length > 0) {
    try {
      await supabase
        .from("products")
        .delete()
        .in("product_id", createdProductIds);
    } catch {
      /* best-effort rollback */
    }
  }
}
