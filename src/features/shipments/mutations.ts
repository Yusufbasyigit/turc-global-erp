import { createClient } from "@/lib/supabase/client";
import { AUTH_DISABLED } from "@/lib/auth-mode";
import type {
  Order,
  OrderStatus,
  Shipment,
  ShipmentInsert,
  ShipmentStatus,
  ShipmentUpdate,
} from "@/lib/supabase/types";
import { NEXT_SHIPMENT_STATUS } from "./constants";
import {
  assertShipmentEditable,
  refreshAccrualsForShipmentTransition,
  refreshShipmentAccruals,
  restoreAccrualSnapshots,
  writeShipmentAccruals,
} from "./billing";
import {
  deleteShipmentDocument,
  uploadShipmentDocument,
} from "./documents";

export {
  uploadShipmentDocument,
  deleteShipmentDocument,
} from "./documents";

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

export async function createShipment(input: {
  id: string;
  payload: Omit<
    ShipmentInsert,
    "id" | "created_by" | "created_time" | "edited_by" | "edited_time" | "status"
  >;
}): Promise<Shipment> {
  const supabase = createClient();
  const userId = await currentUserId();
  const now = new Date().toISOString();
  const payload: ShipmentInsert = {
    ...input.payload,
    id: input.id,
    status: "draft",
    created_by: userId,
    created_time: now,
    edited_by: userId,
    edited_time: now,
  };
  const { data, error } = await supabase
    .from("shipments")
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateShipment(input: {
  id: string;
  payload: Omit<
    ShipmentUpdate,
    "id" | "created_by" | "created_time" | "edited_by" | "edited_time"
  >;
  pendingFile?: File | null;
  removeDocument?: boolean;
  previousDocumentPath?: string | null;
}): Promise<Shipment> {
  const supabase = createClient();
  const userId = await currentUserId();
  const now = new Date().toISOString();

  // freight_currency alone can shift the booked amount, so block it on
  // arrived shipments too — otherwise a UI bypass could change billing
  // without going through assertShipmentEditable.
  const freightChanging =
    "freight_cost" in input.payload || "freight_currency" in input.payload;
  if (freightChanging) {
    await assertShipmentEditable(input.id);
  }

  let nextPath: string | null | undefined = undefined;
  if (input.removeDocument && input.previousDocumentPath) {
    await deleteShipmentDocument(input.previousDocumentPath).catch(() => {});
    nextPath = null;
  }
  if (input.pendingFile) {
    const newPath = await uploadShipmentDocument(input.id, input.pendingFile);
    if (
      input.previousDocumentPath &&
      input.previousDocumentPath !== newPath
    ) {
      await deleteShipmentDocument(input.previousDocumentPath).catch(
        () => {},
      );
    }
    nextPath = newPath;
  }

  const payload: ShipmentUpdate = {
    ...input.payload,
    ...(nextPath !== undefined ? { documents_file: nextPath } : {}),
    edited_by: userId,
    edited_time: now,
  };

  const { data, error } = await supabase
    .from("shipments")
    .update(payload)
    .eq("id", input.id)
    .select()
    .single();
  if (error) throw error;

  if (freightChanging) {
    await refreshShipmentAccruals(input.id);
  }

  return data;
}

async function loadShipment(id: string): Promise<Shipment> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("shipments")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

async function countLinkedOrders(shipmentId: string): Promise<number> {
  const supabase = createClient();
  const { count, error } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("shipment_id", shipmentId);
  if (error) throw error;
  return count ?? 0;
}

export type AdvanceShipmentResult = {
  shipment: Shipment;
  billingAmount?: number;
  billingCurrency?: string;
  cascadedOrderCount?: number;
};

async function setShipmentStatus(
  shipmentId: string,
  status: ShipmentStatus,
  userId: string | null,
  now: string,
): Promise<Shipment> {
  const supabase = createClient();
  const update: ShipmentUpdate = {
    status,
    edited_by: userId,
    edited_time: now,
  };
  const { data, error } = await supabase
    .from("shipments")
    .update(update)
    .eq("id", shipmentId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

const CASCADE_FROM_STATUSES: OrderStatus[] = ["accepted", "in_production"];
const BLOCK_TRANSITION_STATUSES: OrderStatus[] = ["inquiry", "quoted"];

export async function advanceShipmentStatus(input: {
  shipment_id: string;
  to: ShipmentStatus;
}): Promise<AdvanceShipmentResult> {
  const supabase = createClient();
  const userId = await currentUserId();
  const now = new Date().toISOString();

  const current = await loadShipment(input.shipment_id);
  const expectedNext = NEXT_SHIPMENT_STATUS[current.status as ShipmentStatus];
  if (expectedNext !== input.to) {
    throw new Error(
      `Invalid shipment transition from ${current.status} to ${input.to}`,
    );
  }

  if (current.status === "draft" && input.to === "booked") {
    const linked = await countLinkedOrders(current.id);
    if (linked === 0) {
      throw new Error("Add at least one order before booking the shipment.");
    }
    const shipment = await setShipmentStatus(current.id, "booked", userId, now);
    try {
      const result = await writeShipmentAccruals({
        shipmentId: current.id,
        userId,
        now,
      });
      return {
        shipment,
        billingAmount: result.sales,
        billingCurrency: result.billing.currency,
      };
    } catch (err) {
      try {
        await setShipmentStatus(
          current.id,
          "draft",
          current.edited_by,
          current.edited_time ?? now,
        );
      } catch {
        /* best-effort rollback */
      }
      throw err;
    }
  }

  if (current.status === "booked" && input.to === "in_transit") {
    const { data: linkedOrders, error: linkedErr } = await supabase
      .from("orders")
      .select("id, status")
      .eq("shipment_id", current.id);
    if (linkedErr) throw linkedErr;
    const orders = (linkedOrders ?? []) as Pick<Order, "id" | "status">[];

    const blockers = orders.filter((o) =>
      (BLOCK_TRANSITION_STATUSES as readonly string[]).includes(o.status),
    );
    if (blockers.length > 0) {
      const list = blockers.map((b) => b.id.slice(0, 8)).join(", ");
      throw new Error(
        `Cannot ship while ${blockers.length} order(s) are still in inquiry/quoted: ${list}`,
      );
    }

    const toCascade = orders.filter((o) =>
      (CASCADE_FROM_STATUSES as readonly string[]).includes(o.status),
    );

    const accrualRefresh = await refreshAccrualsForShipmentTransition({
      shipmentId: current.id,
      userId,
      now,
    });

    const updatedOrders: Array<{ id: string; previousStatus: string }> = [];
    try {
      const results = await Promise.allSettled(
        toCascade.map(async (o) => {
          const { error } = await supabase
            .from("orders")
            .update({
              status: "shipped",
              edited_by: userId,
              edited_time: now,
            })
            .eq("id", o.id);
          if (error) throw error;
          return { id: o.id, previousStatus: o.status };
        }),
      );
      for (const r of results) {
        if (r.status === "fulfilled") updatedOrders.push(r.value);
      }
      const firstFailure = results.find((r) => r.status === "rejected");
      if (firstFailure) throw (firstFailure as PromiseRejectedResult).reason;

      const shipment = await setShipmentStatus(
        current.id,
        "in_transit",
        userId,
        now,
      );
      return {
        shipment,
        cascadedOrderCount: updatedOrders.length,
      };
    } catch (err) {
      const rollbackResults = await Promise.allSettled(
        updatedOrders.map((u) =>
          supabase
            .from("orders")
            .update({ status: u.previousStatus })
            .eq("id", u.id),
        ),
      );
      const failedRollbacks = rollbackResults
        .map((r, i) => ({ r, id: updatedOrders[i]?.id }))
        .filter((x) => x.r.status === "rejected" && x.id)
        .map((x) => (x.id as string).slice(0, 8));
      try {
        await restoreAccrualSnapshots(accrualRefresh.snapshots);
      } catch (rollbackErr) {
        const baseMessage =
          err instanceof Error ? err.message : "Order cascade failed";
        const rollbackMessage =
          rollbackErr instanceof Error
            ? rollbackErr.message
            : "accrual rollback failed";
        throw new Error(
          `${baseMessage}. Additionally, the billing accrual rollback failed (${rollbackMessage}); please review shipment ${current.id.slice(0, 8)} accrual transactions manually.`,
        );
      }
      if (failedRollbacks.length > 0) {
        const baseMessage =
          err instanceof Error ? err.message : "Order cascade failed";
        throw new Error(
          `${baseMessage}. Additionally, ${failedRollbacks.length} order(s) could not be rolled back to their previous status: ${failedRollbacks.join(", ")}. Please verify their statuses manually.`,
        );
      }
      throw err;
    }
  }

  // in_transit → arrived: status only.
  const shipment = await setShipmentStatus(current.id, input.to, userId, now);
  return { shipment };
}

export async function setShipmentStatementPdfPath(input: {
  shipment_id: string;
  path: string;
}): Promise<Shipment> {
  const supabase = createClient();
  const userId = await currentUserId();
  const now = new Date().toISOString();

  const update: ShipmentUpdate = {
    generated_statement_pdf: input.path,
    edited_by: userId,
    edited_time: now,
  };
  const { data, error } = await supabase
    .from("shipments")
    .update(update)
    .eq("id", input.shipment_id)
    .select()
    .single();
  if (error) throw error;
  return data;
}
