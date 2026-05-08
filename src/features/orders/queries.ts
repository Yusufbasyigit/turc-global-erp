import { createClient } from "@/lib/supabase/client";
import { ORDER_ATTACHMENT_BUCKET } from "@/lib/constants";
import type {
  CustomerSummary,
  Order,
  OrderDetail,
  OrderDetailWithRelations,
  OrderWithRelations,
} from "@/lib/supabase/types";

export const orderKeys = {
  all: ["orders"] as const,
  list: (filters?: Record<string, unknown>) =>
    [...orderKeys.all, "list", filters ?? {}] as const,
  detail: (id: string) => [...orderKeys.all, "detail", id] as const,
  forCustomer: (customerId: string) =>
    [...orderKeys.all, "byCustomer", customerId] as const,
  forProduct: (productId: string) =>
    [...orderKeys.all, "byProduct", productId] as const,
  assignable: (shipmentId: string) =>
    [...orderKeys.all, "assignable", shipmentId] as const,
  customers: () => [...orderKeys.all, "customers"] as const,
};

const ORDER_LIST_SELECT = `
  *,
  customer:contacts!orders_customer_id_fkey(id, company_name, balance_currency),
  shipment:shipments!orders_shipment_id_fkey(id, name, status, invoice_currency),
  order_details:order_details(id, line_number, quantity, unit_sales_price, vat_rate)
`;

const ORDER_DETAIL_SELECT = `
  *,
  customer:contacts!orders_customer_id_fkey(id, company_name, balance_currency),
  shipment:shipments!orders_shipment_id_fkey(id, name, status, invoice_currency),
  order_details:order_details(id, line_number, quantity, unit_sales_price, vat_rate)
`;

const ORDER_DETAILS_LINE_SELECT = `
  *,
  supplier:contacts!order_details_supplier_id_fkey(id, company_name)
`;

function mapListRow(row: unknown): OrderWithRelations {
  const r = row as OrderWithRelations & {
    order_details: Array<{
      id: string;
      line_number: number;
      quantity: number;
      unit_sales_price: number | null;
      vat_rate: number | null;
    }> | null;
  };
  const details = r.order_details ?? [];
  return {
    ...r,
    line_count: details.length,
    order_details: details,
  };
}

export async function listOrders(): Promise<OrderWithRelations[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("orders")
    .select(ORDER_LIST_SELECT)
    .order("order_date", { ascending: false })
    .order("created_time", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapListRow);
}

export async function getOrder(
  id: string,
): Promise<OrderWithRelations | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("orders")
    .select(ORDER_DETAIL_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return mapListRow(data);
}

export async function listOrderDetails(
  orderId: string,
): Promise<OrderDetailWithRelations[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("order_details")
    .select(ORDER_DETAILS_LINE_SELECT)
    .eq("order_id", orderId)
    .order("line_number", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as OrderDetailWithRelations[];
}

export async function listOrdersForCustomer(
  customerId: string,
): Promise<Order[]> {
  if (!customerId) return [];
  const supabase = createClient();
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("customer_id", customerId)
    .order("order_date", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export type OrderForProductRow = {
  order_id: string;
  order_date: string | null;
  order_currency: string | null;
  status: Order["status"];
  customer_name: string | null;
  quantity: number;
  unit_sales_price: number | null;
};

// Lists orders that include the given product on at least one line. Returns
// one row per order_details line (a product can legitimately appear on
// multiple lines of the same order). Uses an inner join on `orders` so the
// list inherits order-level filters and customer info in a single round-trip.
export async function listOrdersForProduct(
  productId: string,
): Promise<OrderForProductRow[]> {
  if (!productId) return [];
  const supabase = createClient();
  const { data, error } = await supabase
    .from("order_details")
    .select(
      `
      id,
      quantity,
      unit_sales_price,
      order:orders!inner(
        id,
        order_date,
        order_currency,
        status,
        customer:contacts!orders_customer_id_fkey(company_name)
      )
    `,
    )
    .eq("product_id", productId)
    .order("order_date", { ascending: false, foreignTable: "order" });
  if (error) throw error;
  type Row = {
    id: string;
    quantity: number;
    unit_sales_price: number | null;
    order: {
      id: string;
      order_date: string | null;
      order_currency: string | null;
      status: Order["status"];
      customer: { company_name: string | null } | null;
    } | null;
  };
  return ((data ?? []) as unknown as Row[])
    .filter((row) => row.order !== null)
    .map((row) => ({
      order_id: row.order!.id,
      order_date: row.order!.order_date,
      order_currency: row.order!.order_currency,
      status: row.order!.status,
      customer_name: row.order!.customer?.company_name ?? null,
      quantity: Number(row.quantity ?? 0),
      unit_sales_price:
        row.unit_sales_price === null ? null : Number(row.unit_sales_price),
    }));
}

// Orders the user can add to a shipment: same customer, unassigned,
// and in an active phase (accepted or in_production).
export async function listAssignableOrdersForShipment(
  shipmentId: string,
  customerId: string,
): Promise<(Order & { line_count: number })[]> {
  if (!shipmentId || !customerId) return [];
  const supabase = createClient();
  const { data, error } = await supabase
    .from("orders")
    .select("*, order_details:order_details(id)")
    .eq("customer_id", customerId)
    .is("shipment_id", null)
    .in("status", ["accepted", "in_production"])
    .order("order_date", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => {
    const r = row as Order & { order_details: Array<{ id: string }> | null };
    return { ...r, line_count: (r.order_details ?? []).length };
  });
}

export async function listCustomerContacts(): Promise<CustomerSummary[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("contacts")
    .select("id, company_name, balance_currency")
    .eq("is_customer", true)
    .is("deleted_at", null)
    .order("company_name", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function orderAttachmentSignedUrl(
  path: string,
  expiresInSec = 3600,
  downloadFilename?: string,
): Promise<string | null> {
  const supabase = createClient();
  const options = downloadFilename ? { download: downloadFilename } : undefined;
  const { data, error } = await supabase.storage
    .from(ORDER_ATTACHMENT_BUCKET)
    .createSignedUrl(path, expiresInSec, options);
  if (error) return null;
  return data?.signedUrl ?? null;
}

export type OrderLineRow = OrderDetail;
