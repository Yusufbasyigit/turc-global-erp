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
  lineTotals,
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
  cogsTotal: (id: string) =>
    [...shipmentKeys.all, "cogsTotal", id] as const,
  totals: (id: string) => [...shipmentKeys.all, "totals", id] as const,
  manifest: (id: string) => [...shipmentKeys.all, "manifest", id] as const,
};

export {
  computeShipmentCogs,
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
      quantity,
      product:products!order_details_product_id_fkey(
        cbm_per_unit,
        weight_kg_per_unit,
        package_length_cm,
        package_width_cm,
        package_height_cm,
        units_per_package
      )
    )
  )
`;

const SHIPMENT_DETAIL_SELECT = `
  *,
  customer:contacts!shipments_customer_id_fkey(id, company_name, balance_currency),
  orders:orders!orders_shipment_id_fkey(id)
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
      orders: OrderRowForTotals[] | null;
    };
    const orders = r.orders ?? [];
    const totals = aggregateShipmentTotals(normalizeOrdersForTotals(orders));
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
        quantity,
        product:products!order_details_product_id_fkey(
          cbm_per_unit,
          weight_kg_per_unit,
          package_length_cm,
          package_width_cm,
          package_height_cm,
          units_per_package
        )
      )`,
    )
    .eq("shipment_id", shipmentId);
  if (error) throw error;
  return aggregateShipmentTotals(normalizeOrdersForTotals(data));
}

// PostgREST embeds the products FK as an array even though the relation
// is to-one. Flatten product[] -> product so DimensionLine sees the shape
// it expects.
type ProductDim = {
  cbm_per_unit: number | null;
  weight_kg_per_unit: number | null;
  package_length_cm: number | null;
  package_width_cm: number | null;
  package_height_cm: number | null;
  units_per_package: number | null;
};
type OrderDetailsRow = {
  cbm_per_unit_snapshot: number | null;
  weight_kg_per_unit_snapshot: number | null;
  package_length_cm: number | null;
  package_width_cm: number | null;
  package_height_cm: number | null;
  units_per_package: number | null;
  quantity: number;
  product: ProductDim | ProductDim[] | null;
};
type OrderRowForTotals = {
  order_details?: OrderDetailsRow[] | null;
} | null;

function normalizeOrdersForTotals(
  orders: readonly OrderRowForTotals[] | null | undefined,
) {
  return (orders ?? []).map((o) => ({
    order_details: (o?.order_details ?? []).map((d) => ({
      ...d,
      product: Array.isArray(d.product)
        ? (d.product[0] ?? null)
        : d.product,
    })),
  }));
}

export type ShipmentManifestLineStatus = "new" | "rolled_over" | "cancelled";

export type ShipmentManifestLine = {
  rowKey: string;
  orderId: string;
  orderDate: string | null;
  orderStatus: string;
  lineNumber: number;
  productName: string;
  quantity: number;
  unit: string | null;
  unitsPerPackage: number | null;
  packagingType: string | null;
  weightKg: number;
  cbm: number;
  missingDimensions: boolean;
  missingWeight: boolean;
  unitPrice: number | null;
  lineTotal: number | null;
  status: ShipmentManifestLineStatus;
  rolledOverToShipmentId: string | null;
  rolledOverToName: string | null;
};

type ManifestProductDim = {
  cbm_per_unit: number | null;
  weight_kg_per_unit: number | null;
  package_length_cm: number | null;
  package_width_cm: number | null;
  package_height_cm: number | null;
  units_per_package: number | null;
};

type ManifestLineRow = {
  id: string;
  line_number: number;
  quantity: number;
  unit_sales_price: number | null;
  product_name_snapshot: string;
  unit_snapshot: string | null;
  packaging_type: string | null;
  units_per_package: number | null;
  package_length_cm: number | null;
  package_width_cm: number | null;
  package_height_cm: number | null;
  cbm_per_unit_snapshot: number | null;
  weight_kg_per_unit_snapshot: number | null;
  product: ManifestProductDim | ManifestProductDim[] | null;
  orders:
    | {
        id: string;
        status: string;
        order_date: string | null;
        billing_shipment_id: string | null;
      }
    | Array<{
        id: string;
        status: string;
        order_date: string | null;
        billing_shipment_id: string | null;
      }>
    | null;
};

export async function listShipmentManifestLines(
  shipmentId: string,
): Promise<ShipmentManifestLine[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("order_details")
    .select(
      `id, line_number, quantity, unit_sales_price, product_name_snapshot, unit_snapshot,
       packaging_type, units_per_package, package_length_cm, package_width_cm, package_height_cm,
       cbm_per_unit_snapshot, weight_kg_per_unit_snapshot,
       product:products!order_details_product_id_fkey(
         cbm_per_unit, weight_kg_per_unit,
         package_length_cm, package_width_cm, package_height_cm, units_per_package
       ),
       orders!inner(id, status, order_date, billing_shipment_id)`,
    )
    .eq("orders.shipment_id", shipmentId);
  if (error) throw error;

  const rows = (data ?? []) as unknown as ManifestLineRow[];

  // Sort by order_date, then order_id, then line_number — same ordering
  // as the PDF statement so the on-screen manifest matches the document.
  const sorted = rows.slice().sort((a, b) => {
    const aOrder = Array.isArray(a.orders) ? a.orders[0] : a.orders;
    const bOrder = Array.isArray(b.orders) ? b.orders[0] : b.orders;
    const ad = aOrder?.order_date ?? "";
    const bd = bOrder?.order_date ?? "";
    if (ad !== bd) return ad < bd ? -1 : 1;
    const aid = aOrder?.id ?? "";
    const bid = bOrder?.id ?? "";
    if (aid !== bid) return aid < bid ? -1 : 1;
    return a.line_number - b.line_number;
  });

  const otherShipmentIds = Array.from(
    new Set(
      sorted
        .map((r) => {
          const o = Array.isArray(r.orders) ? r.orders[0] : r.orders;
          return o?.billing_shipment_id ?? null;
        })
        .filter((v): v is string => Boolean(v) && v !== shipmentId),
    ),
  );

  const otherShipmentNames = new Map<string, string>();
  if (otherShipmentIds.length > 0) {
    const { data: others, error: othersErr } = await supabase
      .from("shipments")
      .select("id, name")
      .in("id", otherShipmentIds);
    if (othersErr) throw othersErr;
    for (const s of others ?? []) {
      otherShipmentNames.set(s.id, s.name);
    }
  }

  return sorted.map((r, i) => {
    const order = Array.isArray(r.orders) ? r.orders[0] : r.orders;
    const product = Array.isArray(r.product) ? (r.product[0] ?? null) : r.product;
    const t = lineTotals({
      cbm_per_unit_snapshot: r.cbm_per_unit_snapshot,
      weight_kg_per_unit_snapshot: r.weight_kg_per_unit_snapshot,
      package_length_cm: r.package_length_cm,
      package_width_cm: r.package_width_cm,
      package_height_cm: r.package_height_cm,
      units_per_package: r.units_per_package,
      quantity: r.quantity,
      product,
    });
    const orderStatus = order?.status ?? "";
    const billingShipmentId = order?.billing_shipment_id ?? null;
    const status: ShipmentManifestLineStatus =
      orderStatus === "cancelled"
        ? "cancelled"
        : billingShipmentId !== null && billingShipmentId !== shipmentId
          ? "rolled_over"
          : "new";
    const qty = Number(r.quantity ?? 0);
    const rawPrice =
      r.unit_sales_price === null ? null : Number(r.unit_sales_price);
    const visible = status === "new";
    const unitPrice = visible ? rawPrice : null;
    const lineTotal = visible && rawPrice !== null ? qty * rawPrice : null;
    return {
      rowKey: r.id,
      orderId: order?.id ?? "",
      orderDate: order?.order_date ?? null,
      orderStatus,
      lineNumber: i + 1,
      productName: r.product_name_snapshot,
      quantity: qty,
      unit: r.unit_snapshot,
      unitsPerPackage: r.units_per_package ?? product?.units_per_package ?? null,
      packagingType: r.packaging_type,
      weightKg: t.weightKg,
      cbm: t.cbm,
      missingDimensions: t.missingDimensions,
      missingWeight: t.missingWeight,
      unitPrice,
      lineTotal,
      status,
      rolledOverToShipmentId:
        status === "rolled_over" ? billingShipmentId : null,
      rolledOverToName:
        status === "rolled_over" && billingShipmentId
          ? otherShipmentNames.get(billingShipmentId) ?? null
          : null,
    };
  });
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
  const r = data as ShipmentWithRelations & {
    orders: Array<{ id: string }> | null;
  };
  return {
    ...r,
    order_count: (r.orders ?? []).length,
  };
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
  downloadFilename?: string,
): Promise<string | null> {
  const supabase = createClient();
  const options = downloadFilename ? { download: downloadFilename } : undefined;
  const { data, error } = await supabase.storage
    .from(SHIPMENT_INVOICE_BUCKET)
    .createSignedUrl(path, expiresInSec, options);
  if (error) return null;
  return data?.signedUrl ?? null;
}
