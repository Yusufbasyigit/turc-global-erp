import { createClient } from "@/lib/supabase/client";
import type {
  Order,
  OrderDetail,
  OrderDetailInsert,
  OrderDetailUpdate,
} from "@/lib/supabase/types";
import {
  assertShipmentEditable,
  refreshShipmentBilling,
} from "@/features/shipments/billing";
import {
  type CreateOrderLineInput,
  currentUserId,
  fetchProductSnapshots,
  loadOrder,
  snapshotFromProduct,
} from "./mutation-helpers";

async function loadLineWithOrder(
  lineId: string,
): Promise<{ line: OrderDetail; order: Order }> {
  const supabase = createClient();
  const { data: line, error: lineErr } = await supabase
    .from("order_details")
    .select("*")
    .eq("id", lineId)
    .single();
  if (lineErr) throw lineErr;
  const order = await loadOrder(line.order_id);
  return { line, order };
}

export async function addOrderLine(input: {
  order_id: string;
  line: CreateOrderLineInput;
}): Promise<OrderDetail> {
  const supabase = createClient();
  const userId = await currentUserId();
  const now = new Date().toISOString();

  const order = await loadOrder(input.order_id);
  await assertShipmentEditable(order.billing_shipment_id);

  const computeNextLineNumber = async (): Promise<number> => {
    const { data: existing, error: countErr } = await supabase
      .from("order_details")
      .select("line_number")
      .eq("order_id", input.order_id)
      .order("line_number", { ascending: false })
      .limit(1);
    if (countErr) throw countErr;
    return (existing?.[0]?.line_number ?? 0) + 1;
  };

  const products = await fetchProductSnapshots([input.line.product_id]);
  const product = products.get(input.line.product_id);
  const snap = product ? snapshotFromProduct(product) : null;

  const buildPayload = (lineNumber: number): OrderDetailInsert => ({
    order_id: input.order_id,
    product_id: input.line.product_id,
    line_number: lineNumber,
    product_name_snapshot:
      input.line.product_name_snapshot ??
      snap?.product_name_snapshot ??
      "",
    product_description_snapshot:
      input.line.product_description_snapshot ??
      snap?.product_description_snapshot ??
      null,
    product_photo_snapshot:
      input.line.product_photo_snapshot ??
      snap?.product_photo_snapshot ??
      null,
    unit_snapshot:
      input.line.unit_snapshot ?? snap?.unit_snapshot ?? "",
    cbm_per_unit_snapshot:
      input.line.cbm_per_unit_snapshot ??
      snap?.cbm_per_unit_snapshot ??
      null,
    weight_kg_per_unit_snapshot:
      input.line.weight_kg_per_unit_snapshot ??
      snap?.weight_kg_per_unit_snapshot ??
      null,
    packaging_type:
      input.line.packaging_type ?? snap?.packaging_type ?? null,
    package_length_cm:
      input.line.package_length_cm ?? snap?.package_length_cm ?? null,
    package_width_cm:
      input.line.package_width_cm ?? snap?.package_width_cm ?? null,
    package_height_cm:
      input.line.package_height_cm ?? snap?.package_height_cm ?? null,
    units_per_package:
      input.line.units_per_package ?? snap?.units_per_package ?? null,
    quantity: input.line.quantity,
    unit_sales_price: input.line.unit_sales_price,
    est_purchase_unit_price: input.line.est_purchase_unit_price,
    actual_purchase_price: input.line.actual_purchase_price,
    vat_rate: input.line.vat_rate,
    supplier_id: input.line.supplier_id ?? snap?.supplier_id ?? null,
    notes: input.line.notes,
    created_by: userId,
    created_time: now,
    edited_by: userId,
    edited_time: now,
  });

  // Two parallel adds can compute the same nextLineNumber; the unique
  // (order_id, line_number) index then rejects the second insert with 23505.
  // Recompute and retry once when that happens.
  const insertOnce = async () => {
    const lineNumber = await computeNextLineNumber();
    return supabase
      .from("order_details")
      .insert(buildPayload(lineNumber))
      .select()
      .single();
  };
  let inserted = await insertOnce();
  if (inserted.error && (inserted.error as { code?: string }).code === "23505") {
    inserted = await insertOnce();
  }
  if (inserted.error) throw inserted.error;
  const data = inserted.data;

  if (order.billing_shipment_id) {
    try {
      await refreshShipmentBilling(order.billing_shipment_id);
    } catch (refreshErr) {
      try {
        await supabase.from("order_details").delete().eq("id", data.id);
      } catch {
        /* best-effort rollback */
      }
      throw refreshErr;
    }
  }

  return data;
}

export async function updateOrderLine(input: {
  line_id: string;
  payload: OrderDetailUpdate;
}): Promise<OrderDetail> {
  const supabase = createClient();
  const userId = await currentUserId();
  const now = new Date().toISOString();

  const { line: previousLine, order } = await loadLineWithOrder(input.line_id);
  await assertShipmentEditable(order.billing_shipment_id);

  const payload: OrderDetailUpdate = {
    ...input.payload,
    edited_by: userId,
    edited_time: now,
  };

  const { data, error } = await supabase
    .from("order_details")
    .update(payload)
    .eq("id", input.line_id)
    .select()
    .single();
  if (error) throw error;

  if (order.billing_shipment_id) {
    try {
      await refreshShipmentBilling(order.billing_shipment_id);
    } catch (refreshErr) {
      try {
        const rollback: Record<string, unknown> = {
          edited_by: previousLine.edited_by,
          edited_time: previousLine.edited_time,
        };
        for (const key of Object.keys(input.payload) as (keyof OrderDetailUpdate)[]) {
          rollback[key as string] = (previousLine as unknown as Record<string, unknown>)[
            key as string
          ];
        }
        await supabase
          .from("order_details")
          .update(rollback as OrderDetailUpdate)
          .eq("id", input.line_id);
      } catch {
        /* best-effort rollback */
      }
      throw refreshErr;
    }
  }

  return data;
}

export async function deleteOrderLine(lineId: string): Promise<void> {
  const supabase = createClient();
  const { line: previousLine, order } = await loadLineWithOrder(lineId);
  await assertShipmentEditable(order.billing_shipment_id);

  const { error } = await supabase
    .from("order_details")
    .delete()
    .eq("id", lineId);
  if (error) throw error;

  if (order.billing_shipment_id) {
    try {
      await refreshShipmentBilling(order.billing_shipment_id);
    } catch (refreshErr) {
      try {
        await supabase.from("order_details").insert(previousLine);
      } catch {
        /* best-effort rollback */
      }
      throw refreshErr;
    }
  }
}
