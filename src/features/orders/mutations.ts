// TODO: split into order-mutations / order-line-mutations / order-shipment-mutations.
// Pre-existing size issue carried over Wave 3a. Tracked for a follow-up session.
import { createClient } from "@/lib/supabase/client";
import { AUTH_DISABLED } from "@/lib/auth-mode";
import { ORDER_ATTACHMENT_BUCKET } from "@/lib/constants";
import type {
  Order,
  OrderDetail,
  OrderDetailInsert,
  OrderDetailUpdate,
  OrderInsert,
  OrderStatus,
  OrderUpdate,
  Product,
} from "@/lib/supabase/types";
import {
  NEXT_ORDER_STATUS,
  TERMINAL_ORDER_STATUSES,
} from "./constants";
import {
  assertShipmentEditable,
  refreshShipmentBilling,
} from "@/features/shipments/billing";
import { generateOfferNumber } from "@/lib/proforma/offer-number";
import {
  getMissingProformaFields,
  type ProformaFormOutput,
} from "@/lib/proforma/schema";

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

export async function uploadCustomerPo(
  orderId: string,
  file: File,
): Promise<string> {
  const supabase = createClient();
  const extMatch = file.name.match(/\.([a-zA-Z0-9]+)$/);
  const ext = extMatch ? extMatch[1].toLowerCase() : "bin";
  const path = `${orderId}/customer_po/${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from(ORDER_ATTACHMENT_BUCKET)
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type,
    });
  if (error) throw error;
  return path;
}

export async function deleteOrderAttachment(path: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.storage
    .from(ORDER_ATTACHMENT_BUCKET)
    .remove([path]);
  if (error) throw error;
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

async function fetchProductSnapshots(
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

export async function createOrder(input: {
  id: string;
  payload: {
    customer_id: string;
    order_date: string;
    order_currency: string;
    notes: string | null;
  };
  lines: CreateOrderLineInput[];
  pendingFile?: File | null;
}): Promise<Order> {
  const supabase = createClient();
  const userId = await currentUserId();
  const now = new Date().toISOString();

  let poPath: string | null = null;
  if (input.pendingFile) {
    poPath = await uploadCustomerPo(input.id, input.pendingFile);
  }

  const productIds = Array.from(new Set(input.lines.map((l) => l.product_id)));
  const products = await fetchProductSnapshots(productIds);

  const orderPayload: OrderInsert = {
    id: input.id,
    customer_id: input.payload.customer_id,
    order_date: input.payload.order_date,
    order_currency: input.payload.order_currency,
    status: "inquiry",
    notes: input.payload.notes,
    customer_po_file: poPath,
    created_by: userId,
    created_time: now,
    edited_by: userId,
    edited_time: now,
  };

  const { data: order, error } = await supabase
    .from("orders")
    .insert(orderPayload)
    .select()
    .single();

  if (error) {
    if (poPath) await deleteOrderAttachment(poPath).catch(() => {});
    throw error;
  }

  if (input.lines.length > 0) {
    const detailInserts: OrderDetailInsert[] = input.lines.map((line, idx) => {
      const product = products.get(line.product_id);
      const snap = product ? snapshotFromProduct(product) : null;
      return {
        order_id: order.id,
        product_id: line.product_id,
        line_number: idx + 1,
        product_name_snapshot:
          line.product_name_snapshot ??
          snap?.product_name_snapshot ??
          "",
        product_description_snapshot:
          line.product_description_snapshot ??
          snap?.product_description_snapshot ??
          null,
        product_photo_snapshot:
          line.product_photo_snapshot ??
          snap?.product_photo_snapshot ??
          null,
        unit_snapshot:
          line.unit_snapshot ?? snap?.unit_snapshot ?? "",
        cbm_per_unit_snapshot:
          line.cbm_per_unit_snapshot ??
          snap?.cbm_per_unit_snapshot ??
          null,
        weight_kg_per_unit_snapshot:
          line.weight_kg_per_unit_snapshot ??
          snap?.weight_kg_per_unit_snapshot ??
          null,
        packaging_type:
          line.packaging_type ?? snap?.packaging_type ?? null,
        package_length_cm:
          line.package_length_cm ?? snap?.package_length_cm ?? null,
        package_width_cm:
          line.package_width_cm ?? snap?.package_width_cm ?? null,
        package_height_cm:
          line.package_height_cm ?? snap?.package_height_cm ?? null,
        units_per_package:
          line.units_per_package ?? snap?.units_per_package ?? null,
        quantity: line.quantity,
        unit_sales_price: line.unit_sales_price,
        est_purchase_unit_price: line.est_purchase_unit_price,
        actual_purchase_price: line.actual_purchase_price,
        vat_rate: line.vat_rate,
        supplier_id: line.supplier_id ?? snap?.supplier_id ?? null,
        notes: line.notes,
        created_by: userId,
        created_time: now,
        edited_by: userId,
        edited_time: now,
      };
    });

    const { error: detailErr } = await supabase
      .from("order_details")
      .insert(detailInserts);

    if (detailErr) {
      await supabase.from("orders").delete().eq("id", order.id);
      if (poPath) await deleteOrderAttachment(poPath).catch(() => {});
      throw detailErr;
    }
  }

  return order;
}

export async function updateOrder(input: {
  id: string;
  payload: {
    order_date?: string;
    order_currency?: string;
    notes?: string | null;
  };
  pendingFile?: File | null;
  removeAttachment?: boolean;
  previousAttachmentPath?: string | null;
}): Promise<Order> {
  const supabase = createClient();
  const userId = await currentUserId();
  const now = new Date().toISOString();

  let nextPath: string | null | undefined = undefined;
  if (input.removeAttachment && input.previousAttachmentPath) {
    await deleteOrderAttachment(input.previousAttachmentPath).catch(() => {});
    nextPath = null;
  }
  if (input.pendingFile) {
    const newPath = await uploadCustomerPo(input.id, input.pendingFile);
    if (
      input.previousAttachmentPath &&
      input.previousAttachmentPath !== newPath
    ) {
      await deleteOrderAttachment(input.previousAttachmentPath).catch(
        () => {},
      );
    }
    nextPath = newPath;
  }

  const updatePayload: OrderUpdate = {
    ...input.payload,
    ...(nextPath !== undefined ? { customer_po_file: nextPath } : {}),
    edited_by: userId,
    edited_time: now,
  };

  const { data, error } = await supabase
    .from("orders")
    .update(updatePayload)
    .eq("id", input.id)
    .select()
    .single();
  if (error) throw error;
  return data;
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

  const { data: existing, error: countErr } = await supabase
    .from("order_details")
    .select("line_number")
    .eq("order_id", input.order_id)
    .order("line_number", { ascending: false })
    .limit(1);
  if (countErr) throw countErr;
  const nextLineNumber = (existing?.[0]?.line_number ?? 0) + 1;

  const products = await fetchProductSnapshots([input.line.product_id]);
  const product = products.get(input.line.product_id);
  const snap = product ? snapshotFromProduct(product) : null;

  const payload: OrderDetailInsert = {
    order_id: input.order_id,
    product_id: input.line.product_id,
    line_number: nextLineNumber,
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
  };

  const { data, error } = await supabase
    .from("order_details")
    .insert(payload)
    .select()
    .single();
  if (error) throw error;

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
        await supabase
          .from("order_details")
          .update({
            quantity: previousLine.quantity,
            unit_sales_price: previousLine.unit_sales_price,
            edited_by: previousLine.edited_by,
            edited_time: previousLine.edited_time,
          })
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

async function loadOrder(orderId: string): Promise<Order> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .single();
  if (error) throw error;
  return data;
}

export async function advanceOrderStatus(input: {
  order_id: string;
  to: OrderStatus;
}): Promise<Order> {
  const supabase = createClient();
  const userId = await currentUserId();
  const now = new Date().toISOString();

  const current = await loadOrder(input.order_id);
  const expectedNext = NEXT_ORDER_STATUS[current.status as OrderStatus];
  if (expectedNext !== input.to) {
    throw new Error(
      `Invalid transition from ${current.status} to ${input.to}`,
    );
  }

  // Gates.
  if (current.status === "inquiry" && input.to === "quoted") {
    const { data: lines, error: gateErr } = await supabase
      .from("order_details")
      .select("id, unit_sales_price")
      .eq("order_id", current.id);
    if (gateErr) throw gateErr;
    if (!lines || lines.length === 0) {
      throw new Error("Add at least one line before quoting.");
    }
    const unpriced = lines.find(
      (l) => l.unit_sales_price === null || Number(l.unit_sales_price) <= 0,
    );
    if (unpriced) {
      throw new Error("All lines need a sales price before quoting.");
    }

    const missing = getMissingProformaFields({
      offer_date: (current as unknown as { offer_date: string | null })
        .offer_date,
      incoterm: (current as unknown as { incoterm: string | null }).incoterm,
      payment_terms: (current as unknown as { payment_terms: string | null })
        .payment_terms,
    });
    if (missing.length > 0) {
      throw new Error(
        `Cannot move to Quoted: please fill in ${missing.join(", ")}.`,
      );
    }
  }

  if (current.status === "in_production" && input.to === "shipped") {
    if (!current.shipment_id) {
      throw new Error(
        "Assign the order to a shipment before marking it shipped.",
      );
    }
    const { data: shipment, error: shipErr } = await supabase
      .from("shipments")
      .select("status")
      .eq("id", current.shipment_id)
      .single();
    if (shipErr) throw shipErr;
    if (shipment.status === "draft") {
      throw new Error(
        "Book the assigned shipment before marking the order shipped.",
      );
    }
  }

  const update: OrderUpdate = {
    status: input.to,
    edited_by: userId,
    edited_time: now,
  };

  const { data, error } = await supabase
    .from("orders")
    .update(update)
    .eq("id", current.id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Cancellation detaches the order from both shipment_id and
// billing_shipment_id so shipment CBM/counts stay accurate.
export async function cancelOrder(input: {
  order_id: string;
  reason: string;
}): Promise<Order> {
  const supabase = createClient();
  const userId = await currentUserId();
  const now = new Date().toISOString();

  const reason = input.reason.trim();
  if (!reason) throw new Error("Cancellation reason is required.");

  const current = await loadOrder(input.order_id);
  if ((TERMINAL_ORDER_STATUSES as readonly string[]).includes(current.status)) {
    throw new Error(`Order is already ${current.status}.`);
  }

  const previousBillingShipmentId = current.billing_shipment_id;
  await assertShipmentEditable(previousBillingShipmentId);

  const update: OrderUpdate = {
    status: "cancelled",
    cancelled_at: now,
    cancellation_reason: reason,
    shipment_id: null,
    billing_shipment_id: null,
    edited_by: userId,
    edited_time: now,
  };

  const { data, error } = await supabase
    .from("orders")
    .update(update)
    .eq("id", current.id)
    .select()
    .single();
  if (error) throw error;

  if (previousBillingShipmentId) {
    try {
      await refreshShipmentBilling(previousBillingShipmentId);
    } catch (refreshErr) {
      try {
        await supabase
          .from("orders")
          .update({
            status: current.status,
            cancelled_at: current.cancelled_at,
            cancellation_reason: current.cancellation_reason,
            shipment_id: current.shipment_id,
            billing_shipment_id: current.billing_shipment_id,
            edited_by: current.edited_by,
            edited_time: current.edited_time,
          })
          .eq("id", current.id);
      } catch {
        /* best-effort rollback */
      }
      throw refreshErr;
    }
  }

  return data;
}

// Sets shipment_id and (if currently null) defaults billing_shipment_id to
// the same shipment per the spec. When `billing_shipment_id` is passed
// explicitly, it overrides the default — this is the roll-over case where
// goods physically ship on one shipment but stay billed on another.
export async function assignOrderToShipment(input: {
  order_id: string;
  shipment_id: string;
  billing_shipment_id?: string | null;
}): Promise<Order> {
  const supabase = createClient();
  const userId = await currentUserId();
  const now = new Date().toISOString();

  const current = await loadOrder(input.order_id);
  const nextBillingShipmentId =
    input.billing_shipment_id !== undefined
      ? input.billing_shipment_id
      : (current.billing_shipment_id ?? input.shipment_id);
  const billingChanged =
    nextBillingShipmentId !== current.billing_shipment_id;

  if (billingChanged) {
    await assertShipmentEditable(nextBillingShipmentId);
  }

  const update: OrderUpdate = {
    shipment_id: input.shipment_id,
    billing_shipment_id: nextBillingShipmentId,
    edited_by: userId,
    edited_time: now,
  };
  const { data, error } = await supabase
    .from("orders")
    .update(update)
    .eq("id", current.id)
    .select()
    .single();
  if (error) throw error;

  if (billingChanged && nextBillingShipmentId) {
    try {
      await refreshShipmentBilling(nextBillingShipmentId);
    } catch (refreshErr) {
      try {
        await supabase
          .from("orders")
          .update({
            shipment_id: current.shipment_id,
            billing_shipment_id: current.billing_shipment_id,
            edited_by: current.edited_by,
            edited_time: current.edited_time,
          })
          .eq("id", current.id);
      } catch {
        /* best-effort rollback */
      }
      throw refreshErr;
    }
  }

  return data;
}

// Removes only shipment_id. Leaves billing_shipment_id alone so rolled-over
// billing stays intact.
export async function unassignOrderFromShipment(
  orderId: string,
): Promise<Order> {
  const supabase = createClient();
  const userId = await currentUserId();
  const now = new Date().toISOString();
  const update: OrderUpdate = {
    shipment_id: null,
    edited_by: userId,
    edited_time: now,
  };
  const { data, error } = await supabase
    .from("orders")
    .update(update)
    .eq("id", orderId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Writes the proforma metadata onto the order row. If offer_number is still
// null and the payload has an offer_date, generates a TG-YYYYMMDD-NNN number
// and includes it in the same UPDATE. Retries once on 23505 (unique violation)
// so a same-day race between two tabs doesn't stick.
export async function updateOrderProformaMetadata(input: {
  order_id: string;
  payload: ProformaFormOutput;
}): Promise<Order> {
  const supabase = createClient();
  const userId = await currentUserId();
  const now = new Date().toISOString();

  const current = await loadOrder(input.order_id);
  const existingOfferNumber = (
    current as unknown as { offer_number: string | null }
  ).offer_number;
  const offerDate =
    input.payload.offer_date ??
    (current as unknown as { offer_date: string | null }).offer_date;

  const baseUpdate: Record<string, unknown> = {
    ...input.payload,
    edited_by: userId,
    edited_time: now,
  };

  const attempt = async (): Promise<Order> => {
    const update: Record<string, unknown> = { ...baseUpdate };
    if (!existingOfferNumber && offerDate) {
      update.offer_number = await generateOfferNumber(supabase, offerDate);
    }
    const { data, error } = await supabase
      .from("orders")
      .update(update as OrderUpdate)
      .eq("id", current.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  };

  try {
    return await attempt();
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "23505") return await attempt();
    throw err;
  }
}

export async function setOrderProposalPdfPath(input: {
  order_id: string;
  path: string;
}): Promise<Order> {
  const supabase = createClient();
  const userId = await currentUserId();
  const now = new Date().toISOString();

  const update: OrderUpdate = {
    proposal_pdf: input.path,
    edited_by: userId,
    edited_time: now,
  };
  const { data, error } = await supabase
    .from("orders")
    .update(update)
    .eq("id", input.order_id)
    .select()
    .single();
  if (error) throw error;
  return data;
}
