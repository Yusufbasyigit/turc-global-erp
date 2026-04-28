import { createClient } from "@/lib/supabase/client";
import {
  SHIPMENT_DOCUMENTS_BUCKET,
  SHIPMENT_INVOICE_BUCKET,
} from "@/lib/constants";
import type {
  OrderStatus,
  Shipment,
  ShipmentStatus,
  ShipmentWithRelations,
} from "@/lib/supabase/types";
import {
  aggregateShipmentTotals,
  type ShipmentTotals,
} from "@/lib/shipments/dimensions";

export const shipmentKeys = {
  all: ["shipments"] as const,
  list: (filters?: Record<string, unknown>) =>
    [...shipmentKeys.all, "list", filters ?? {}] as const,
  detail: (id: string) => [...shipmentKeys.all, "detail", id] as const,
  forCustomer: (customerId: string) =>
    [...shipmentKeys.all, "byCustomer", customerId] as const,
  linkedOrders: (id: string) =>
    [...shipmentKeys.all, "linkedOrders", id] as const,
  billingTotal: (id: string) =>
    [...shipmentKeys.all, "billingTotal", id] as const,
  billingTxn: (id: string) =>
    [...shipmentKeys.all, "billingTxn", id] as const,
  totals: (id: string) => [...shipmentKeys.all, "totals", id] as const,
};

export {
  computeShipmentTotal,
  findShipmentBillingTransaction,
} from "./billing";

const SHIPMENT_LIST_SELECT = `
  *,
  customer:contacts!shipments_customer_id_fkey(id, company_name, balance_currency),
  orders:orders!orders_shipment_id_fkey(
    id,
    order_details:order_details(
      cbm_per_unit_snapshot,
      weight_kg_per_unit_snapshot,
      package_length_cm,
      package_width_cm,
      package_height_cm,
      units_per_package,
      quantity
    )
  )
`;

const SHIPMENT_DETAIL_SELECT = `
  *,
  customer:contacts!shipments_customer_id_fkey(id, company_name, balance_currency)
`;

export type ShipmentListRow = ShipmentWithRelations & {
  total_cbm: number;
  total_weight_kg: number;
  totals: ShipmentTotals;
};

export async function listShipments(): Promise<ShipmentListRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("shipments")
    .select(SHIPMENT_LIST_SELECT)
    .order("etd_date", { ascending: false, nullsFirst: false })
    .order("created_time", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => {
    const r = row as ShipmentWithRelations & {
      orders:
        | Array<{
            id: string;
            order_details:
              | Array<{
                  cbm_per_unit_snapshot: number | null;
                  weight_kg_per_unit_snapshot: number | null;
                  package_length_cm: number | null;
                  package_width_cm: number | null;
                  package_height_cm: number | null;
                  units_per_package: number | null;
                  quantity: number;
                }>
              | null;
          }>
        | null;
    };
    const orders = r.orders ?? [];
    const totals = aggregateShipmentTotals(orders);
    return {
      ...r,
      order_count: orders.length,
      total_cbm: totals.cbm,
      total_weight_kg: totals.weightKg,
      totals,
    };
  });
}

// Same aggregation as the list query but for a single shipment, used on
// the detail page where we want the capacity panel without re-deriving
// the math elsewhere.
export async function getShipmentTotals(
  shipmentId: string,
): Promise<ShipmentTotals> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("orders")
    .select(
      `id, order_details:order_details(
        cbm_per_unit_snapshot,
        weight_kg_per_unit_snapshot,
        package_length_cm,
        package_width_cm,
        package_height_cm,
        units_per_package,
        quantity
      )`,
    )
    .eq("shipment_id", shipmentId);
  if (error) throw error;
  return aggregateShipmentTotals(data ?? []);
}

export async function getShipment(
  id: string,
): Promise<ShipmentWithRelations | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("shipments")
    .select(SHIPMENT_DETAIL_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { ...(data as unknown as ShipmentWithRelations), order_count: 0 };
}

export type ShipmentCascadePreviewOrder = {
  order_id: string;
  customer_name: string;
  current_status: OrderStatus;
  new_status: OrderStatus;
};

// Lists the orders whose status would flip if the shipment advanced to
// `to`. Mirrors the cascade logic in advanceShipmentStatus — only the
// booked → in_transit transition currently touches orders (accepted /
// in_production → shipped). All other transitions return [].
export async function previewShipmentCascade(input: {
  shipment_id: string;
  to: ShipmentStatus;
}): Promise<ShipmentCascadePreviewOrder[]> {
  if (input.to !== "in_transit") return [];
  const supabase = createClient();
  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, status, customer:contacts!orders_customer_id_fkey(company_name)",
    )
    .eq("shipment_id", input.shipment_id)
    .in("status", ["accepted", "in_production"]);
  if (error) throw error;
  return (data ?? []).map((o) => {
    const customer = o.customer as { company_name?: string | null } | null;
    return {
      order_id: o.id,
      customer_name: customer?.company_name ?? "—",
      current_status: o.status as OrderStatus,
      new_status: "shipped" as OrderStatus,
    };
  });
}

export async function listDraftShipmentsForCustomer(
  customerId: string,
): Promise<Shipment[]> {
  if (!customerId) return [];
  const supabase = createClient();
  const { data, error } = await supabase
    .from("shipments")
    .select("*")
    .eq("customer_id", customerId)
    .in("status", ["draft", "booked"])
    .order("created_time", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function countShipmentsForCustomer(
  customerId: string,
): Promise<number> {
  if (!customerId) return 0;
  const supabase = createClient();
  const { count, error } = await supabase
    .from("shipments")
    .select("id", { count: "exact", head: true })
    .eq("customer_id", customerId);
  if (error) throw error;
  return count ?? 0;
}

export async function shipmentDocumentSignedUrl(
  path: string,
  expiresInSec = 3600,
): Promise<string | null> {
  const supabase = createClient();
  const { data, error } = await supabase.storage
    .from(SHIPMENT_DOCUMENTS_BUCKET)
    .createSignedUrl(path, expiresInSec);
  if (error) return null;
  return data?.signedUrl ?? null;
}

export async function shipmentInvoiceSignedUrl(
  path: string,
  expiresInSec = 3600,
): Promise<string | null> {
  const supabase = createClient();
  const { data, error } = await supabase.storage
    .from(SHIPMENT_INVOICE_BUCKET)
    .createSignedUrl(path, expiresInSec);
  if (error) return null;
  return data?.signedUrl ?? null;
}
