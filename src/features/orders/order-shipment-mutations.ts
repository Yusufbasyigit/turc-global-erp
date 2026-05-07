import { createClient } from "@/lib/supabase/client";
import type { Order, OrderUpdate } from "@/lib/supabase/types";
import {
  assertShipmentEditable,
  refreshShipmentBilling,
} from "@/features/shipments/billing";
import { currentUserId, loadOrder } from "./mutation-helpers";

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
  const previousBillingShipmentId = current.billing_shipment_id;
  const nextBillingShipmentId =
    input.billing_shipment_id !== undefined
      ? input.billing_shipment_id
      : (previousBillingShipmentId ?? input.shipment_id);
  const billingChanged = nextBillingShipmentId !== previousBillingShipmentId;

  if (billingChanged) {
    if (nextBillingShipmentId) {
      await assertShipmentEditable(nextBillingShipmentId);
    }
    if (previousBillingShipmentId) {
      await assertShipmentEditable(previousBillingShipmentId);
    }
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

  if (billingChanged) {
    const rollbackOrder = async () => {
      try {
        await supabase
          .from("orders")
          .update({
            shipment_id: current.shipment_id,
            billing_shipment_id: previousBillingShipmentId,
            edited_by: current.edited_by,
            edited_time: current.edited_time,
          })
          .eq("id", current.id);
      } catch {
        /* best-effort rollback */
      }
    };

    let nextRefreshed = false;
    try {
      if (nextBillingShipmentId) {
        await refreshShipmentBilling(nextBillingShipmentId);
        nextRefreshed = true;
      }
      if (previousBillingShipmentId) {
        await refreshShipmentBilling(previousBillingShipmentId);
      }
    } catch (refreshErr) {
      await rollbackOrder();
      // If we already refreshed the new side, re-run it post-rollback so its
      // accruals match the rolled-back order assignment. Best-effort.
      if (nextRefreshed && nextBillingShipmentId) {
        try {
          await refreshShipmentBilling(nextBillingShipmentId);
        } catch {
          /* best-effort */
        }
      }
      throw refreshErr;
    }
  }

  return data;
}

// Removes only shipment_id. Leaves billing_shipment_id alone so rolled-over
// billing stays intact. If the order is still billed on a shipment, that
// shipment must still be editable — otherwise unassigning the physical
// shipment would let the user edit lines on a locked accrual.
export async function unassignOrderFromShipment(
  orderId: string,
): Promise<Order> {
  const supabase = createClient();
  const userId = await currentUserId();
  const now = new Date().toISOString();

  const current = await loadOrder(orderId);
  if (current.billing_shipment_id) {
    await assertShipmentEditable(current.billing_shipment_id);
  }

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
