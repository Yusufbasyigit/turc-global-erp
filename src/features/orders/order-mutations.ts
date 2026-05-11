import { createClient } from "@/lib/supabase/client";
import { ORDER_ATTACHMENT_BUCKET } from "@/lib/constants";
import type {
  Order,
  OrderDetailInsert,
  OrderInsert,
  OrderStatus,
  OrderUpdate,
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
import {
  type CreateOrderLineInput,
  currentUserId,
  fetchProductSnapshots,
  loadOrder,
  snapshotFromProduct,
} from "./mutation-helpers";
import { checkOrderCurrencyChange } from "./order-currency-lock";

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

  // Changing order_currency once priced lines or a shipment_billing accrual
  // exist would silently re-denominate the unit_sales_price / purchase_price
  // snapshots and the booked transaction rows (SUM is currency-blind). Mirror
  // the four other write-side guards documented in the 2026-05-08 entry.
  if (input.payload.order_currency !== undefined) {
    const { data: existing, error: existingErr } = await supabase
      .from("orders")
      .select("order_currency, billing_shipment_id")
      .eq("id", input.id)
      .maybeSingle();
    if (existingErr) throw existingErr;
    if (existing && existing.order_currency !== input.payload.order_currency) {
      const { count: pricedCount, error: detailErr } = await supabase
        .from("order_details")
        .select("id", { count: "exact", head: true })
        .eq("order_id", input.id)
        .or(
          "unit_sales_price.not.is.null,est_purchase_unit_price.not.is.null,actual_purchase_price.not.is.null",
        );
      if (detailErr) throw detailErr;

      let billingCount = 0;
      if (existing.billing_shipment_id) {
        const { count: txCount, error: txErr } = await supabase
          .from("transactions")
          .select("id", { count: "exact", head: true })
          .eq("related_shipment_id", existing.billing_shipment_id)
          .eq("kind", "shipment_billing");
        if (txErr) throw txErr;
        billingCount = txCount ?? 0;
      }

      const verdict = checkOrderCurrencyChange({
        currentCurrency: existing.order_currency,
        nextCurrency: input.payload.order_currency,
        pricedLineCount: pricedCount ?? 0,
        billingAccrualCount: billingCount,
      });
      if (!verdict.ok) throw new Error(verdict.message);
    }
  }

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
      offer_date: current.offer_date,
      incoterm: current.incoterm,
      payment_terms: current.payment_terms,
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

// Admin escape hatch for the auto-generated TG-YYYYMMDD-NNN offer number —
// e.g. matching a number from a paper proforma, or correcting a typo. Pass
// `null` to clear (lets the next save regenerate one). 23505 from a unique
// collision is surfaced as a readable error.
export async function setOrderOfferNumber(input: {
  order_id: string;
  offer_number: string | null;
}): Promise<Order> {
  const supabase = createClient();
  const userId = await currentUserId();
  const now = new Date().toISOString();

  const trimmed =
    typeof input.offer_number === "string"
      ? input.offer_number.trim()
      : null;
  const next = trimmed === null || trimmed === "" ? null : trimmed;

  const update: OrderUpdate = {
    offer_number: next,
    edited_by: userId,
    edited_time: now,
  };

  const { data, error } = await supabase
    .from("orders")
    .update(update)
    .eq("id", input.order_id)
    .select()
    .single();
  if (error) {
    if ((error as { code?: string }).code === "23505") {
      throw new Error(
        `Offer number "${next}" is already used on another order.`,
      );
    }
    throw error;
  }
  return data;
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
