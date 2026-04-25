import { createClient } from "@/lib/supabase/client";
import { AUTH_DISABLED } from "@/lib/auth-mode";
import type {
  Shipment,
  ShipmentStatus,
  Transaction,
  TransactionInsert,
  TransactionUpdate,
} from "@/lib/supabase/types";

const ARRIVED_BLOCK_MESSAGE =
  "Cannot modify billing amount on arrived shipment. Use an adjustment transaction instead.";

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

export async function computeShipmentTotal(
  shipmentId: string,
): Promise<number> {
  const supabase = createClient();

  const { data: shipment, error: shipErr } = await supabase
    .from("shipments")
    .select("freight_cost")
    .eq("id", shipmentId)
    .single();
  if (shipErr) throw shipErr;

  const { data: lines, error: linesErr } = await supabase
    .from("order_details")
    .select(
      "quantity, unit_sales_price, orders!inner(billing_shipment_id, status)",
    )
    .eq("orders.billing_shipment_id", shipmentId)
    .neq("orders.status", "cancelled");
  if (linesErr) throw linesErr;

  let lineTotal = 0;
  for (const l of lines ?? []) {
    const qty = Number(l.quantity ?? 0);
    const price = Number(l.unit_sales_price ?? 0);
    lineTotal += qty * price;
  }

  const freight = Number(shipment?.freight_cost ?? 0);
  return lineTotal + freight;
}

export async function findShipmentBillingTransaction(
  shipmentId: string,
): Promise<Transaction | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .eq("related_shipment_id", shipmentId)
    .eq("kind", "shipment_billing")
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function loadShipmentForBilling(shipmentId: string): Promise<Shipment> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("shipments")
    .select("*")
    .eq("id", shipmentId)
    .single();
  if (error) throw error;
  return data;
}

export async function writeShipmentBilling(args: {
  shipmentId: string;
  userId: string | null;
  now: string;
}): Promise<{ transaction: Transaction; total: number }> {
  const supabase = createClient();
  const shipment = await loadShipmentForBilling(args.shipmentId);
  if (!shipment.customer_id) {
    throw new Error("Shipment has no customer; cannot write billing.");
  }
  const total = await computeShipmentTotal(args.shipmentId);
  const today = args.now.slice(0, 10);

  const payload: TransactionInsert = {
    kind: "shipment_billing",
    transaction_date: today,
    contact_id: shipment.customer_id,
    partner_id: null,
    amount: total,
    currency: shipment.invoice_currency,
    related_shipment_id: shipment.id,
    description: `Billing for shipment: ${shipment.name}`,
    vat_rate: null,
    vat_amount: null,
    net_amount: null,
    fx_rate_applied: null,
    fx_target_currency: null,
    fx_converted_amount: null,
    reference_number: shipment.name,
    attachment_path: null,
    created_by: args.userId,
    created_time: args.now,
    edited_by: args.userId,
    edited_time: args.now,
  };

  const { data, error } = await supabase
    .from("transactions")
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return { transaction: data, total };
}

export async function refreshShipmentBilling(shipmentId: string): Promise<{
  status: ShipmentStatus;
  newTotal: number;
  transactionId: string | null;
} | null> {
  const supabase = createClient();
  const shipment = await loadShipmentForBilling(shipmentId);
  const status = shipment.status as ShipmentStatus;

  if (status === "draft") {
    return { status, newTotal: 0, transactionId: null };
  }

  if (status === "arrived") {
    throw new Error(ARRIVED_BLOCK_MESSAGE);
  }

  const existing = await findShipmentBillingTransaction(shipmentId);
  if (!existing) {
    throw new Error(
      `Data integrity: shipment ${shipmentId} is ${status} but has no shipment_billing transaction.`,
    );
  }

  const userId = await currentUserId();
  const now = new Date().toISOString();
  const newTotal = await computeShipmentTotal(shipmentId);

  const update: TransactionUpdate = {
    amount: newTotal,
    edited_by: userId,
    edited_time: now,
  };

  const { error } = await supabase
    .from("transactions")
    .update(update)
    .eq("id", existing.id);
  if (error) throw error;

  return { status, newTotal, transactionId: existing.id };
}

export async function assertShipmentEditable(
  shipmentId: string | null | undefined,
): Promise<void> {
  if (!shipmentId) return;
  const supabase = createClient();
  const { data, error } = await supabase
    .from("shipments")
    .select("status")
    .eq("id", shipmentId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return;
  if ((data.status as ShipmentStatus) === "arrived") {
    throw new Error(ARRIVED_BLOCK_MESSAGE);
  }
}

export async function refreshBillingForShipmentTransition(args: {
  shipmentId: string;
  userId: string | null;
  now: string;
}): Promise<{
  transactionId: string;
  previousAmount: number;
  previousEdited: { edited_by: string | null; edited_time: string | null };
  newTotal: number;
}> {
  const supabase = createClient();
  const existing = await findShipmentBillingTransaction(args.shipmentId);
  if (!existing) {
    throw new Error(
      `Data integrity: shipment ${args.shipmentId} has no shipment_billing transaction to refresh.`,
    );
  }

  const newTotal = await computeShipmentTotal(args.shipmentId);

  const update: TransactionUpdate = {
    amount: newTotal,
    edited_by: args.userId,
    edited_time: args.now,
  };

  const { error } = await supabase
    .from("transactions")
    .update(update)
    .eq("id", existing.id);
  if (error) throw error;

  return {
    transactionId: existing.id,
    previousAmount: Number(existing.amount),
    previousEdited: {
      edited_by: existing.edited_by,
      edited_time: existing.edited_time,
    },
    newTotal,
  };
}

export async function restoreBillingAmount(args: {
  transactionId: string;
  amount: number;
  edited: { edited_by: string | null; edited_time: string | null };
}): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("transactions")
    .update({
      amount: args.amount,
      edited_by: args.edited.edited_by,
      edited_time: args.edited.edited_time,
    })
    .eq("id", args.transactionId);
  if (error) throw error;
}
