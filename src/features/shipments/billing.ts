import { createClient } from "@/lib/supabase/client";
import { AUTH_DISABLED } from "@/lib/auth-mode";
import { istanbulToday } from "@/lib/format-date";
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

// --- Pure helpers (unit-testable) ---

export type ShipmentLineInput = {
  quantity: number | string | null;
  unit_sales_price: number | string | null;
  actual_purchase_price?: number | string | null;
  est_purchase_unit_price?: number | string | null;
};

export function computeSalesTotal(lines: ShipmentLineInput[]): number {
  let total = 0;
  for (const l of lines) {
    const qty = Number(l.quantity ?? 0);
    const price = Number(l.unit_sales_price ?? 0);
    total += qty * price;
  }
  return total;
}

export function computeCogsTotal(lines: ShipmentLineInput[]): number {
  let total = 0;
  for (const l of lines) {
    const qty = Number(l.quantity ?? 0);
    const actual = l.actual_purchase_price;
    const est = l.est_purchase_unit_price;
    const cost =
      actual !== null && actual !== undefined
        ? Number(actual)
        : est !== null && est !== undefined
          ? Number(est)
          : 0;
    total += qty * cost;
  }
  return total;
}

// --- DB queries ---

async function fetchShipmentLines(
  shipmentId: string,
): Promise<ShipmentLineInput[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("order_details")
    .select(
      "quantity, unit_sales_price, actual_purchase_price, est_purchase_unit_price, orders!inner(billing_shipment_id, status)",
    )
    .eq("orders.billing_shipment_id", shipmentId)
    .neq("orders.status", "cancelled");
  if (error) throw error;
  return (data ?? []) as ShipmentLineInput[];
}

export async function computeShipmentSales(
  shipmentId: string,
): Promise<number> {
  const lines = await fetchShipmentLines(shipmentId);
  return computeSalesTotal(lines);
}

export async function computeShipmentCogs(
  shipmentId: string,
): Promise<number> {
  const lines = await fetchShipmentLines(shipmentId);
  return computeCogsTotal(lines);
}

export async function findShipmentTransaction(
  shipmentId: string,
  kind: "shipment_billing" | "shipment_cogs" | "shipment_freight",
): Promise<Transaction | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .eq("related_shipment_id", shipmentId)
    .eq("kind", kind)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Back-compat name still used in a couple of places.
export const findShipmentBillingTransaction = (shipmentId: string) =>
  findShipmentTransaction(shipmentId, "shipment_billing");

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

// --- Writes ---

type AccrualKind = "shipment_billing" | "shipment_cogs" | "shipment_freight";

function buildAccrualPayload(args: {
  shipment: Shipment;
  kind: AccrualKind;
  amount: number;
  currency: string;
  description: string;
  reference: string | null;
  contactId: string | null;
  date: string;
  userId: string | null;
  now: string;
}): TransactionInsert {
  return {
    kind: args.kind,
    transaction_date: args.date,
    contact_id: args.contactId,
    partner_id: null,
    amount: args.amount,
    currency: args.currency,
    related_shipment_id: args.shipment.id,
    description: args.description,
    vat_rate: null,
    vat_amount: null,
    net_amount: null,
    fx_rate_applied: null,
    fx_target_currency: null,
    fx_converted_amount: null,
    reference_number: args.reference,
    attachment_path: null,
    created_by: args.userId,
    created_time: args.now,
    edited_by: args.userId,
    edited_time: args.now,
  };
}

export type ShipmentAccrualsResult = {
  billing: Transaction;
  cogs: Transaction | null;
  freight: Transaction | null;
  sales: number;
  cogsAmount: number;
  freightAmount: number;
};

export async function writeShipmentAccruals(args: {
  shipmentId: string;
  userId: string | null;
  now: string;
}): Promise<ShipmentAccrualsResult> {
  const supabase = createClient();
  const shipment = await loadShipmentForBilling(args.shipmentId);
  if (!shipment.customer_id) {
    throw new Error("Shipment has no customer; cannot write billing.");
  }
  const lines = await fetchShipmentLines(args.shipmentId);
  const sales = computeSalesTotal(lines);
  const cogs = computeCogsTotal(lines);
  const freight = Number(shipment.freight_cost ?? 0);
  // `args.now` is a full UTC ISO timestamp used for the audit columns
  // (`created_time` / `edited_time`). The `transaction_date` column is a
  // date-only Istanbul-anchored value — slicing UTC would post late-night
  // bookings to yesterday's ledger.
  const today = istanbulToday();

  if (sales <= 0) {
    throw new Error(
      "Cannot book a shipment with no sales total. Set unit sales prices on the order lines first.",
    );
  }

  const payloads: TransactionInsert[] = [
    buildAccrualPayload({
      shipment,
      kind: "shipment_billing",
      amount: sales,
      currency: shipment.invoice_currency,
      description: `Billing for shipment: ${shipment.name}`,
      reference: shipment.name,
      contactId: shipment.customer_id,
      date: today,
      userId: args.userId,
      now: args.now,
    }),
  ];
  if (cogs > 0) {
    payloads.push(
      buildAccrualPayload({
        shipment,
        kind: "shipment_cogs",
        amount: cogs,
        currency: shipment.invoice_currency,
        description: `COGS for shipment: ${shipment.name}`,
        reference: shipment.name,
        contactId: null,
        date: today,
        userId: args.userId,
        now: args.now,
      }),
    );
  }
  if (freight > 0) {
    payloads.push(
      buildAccrualPayload({
        shipment,
        kind: "shipment_freight",
        amount: freight,
        currency: shipment.freight_currency ?? shipment.invoice_currency,
        description: `Freight for shipment: ${shipment.name}`,
        reference: shipment.name,
        contactId: null,
        date: today,
        userId: args.userId,
        now: args.now,
      }),
    );
  }

  // Single multi-row INSERT — PostgreSQL executes this as one statement,
  // so the trio is naturally atomic: a constraint violation on any row
  // (e.g. unique violation from a duplicate Book click, blocked by
  // uniq_shipment_accrual) rolls back all of them. No manual cleanup
  // path means no silent rollback failures.
  const { data: insertedRows, error } = await supabase
    .from("transactions")
    .insert(payloads)
    .select();
  if (error) throw error;
  if (!insertedRows || insertedRows.length !== payloads.length) {
    throw new Error(
      `Batch insert returned ${insertedRows?.length ?? 0} rows, expected ${payloads.length}.`,
    );
  }

  // Rows return in insert order — billing is always first, then cogs and
  // freight in the order they were appended.
  const billingRow = insertedRows[0];
  let nextIdx = 1;
  const cogsRow: Transaction | null = cogs > 0 ? insertedRows[nextIdx++] : null;
  const freightRow: Transaction | null =
    freight > 0 ? insertedRows[nextIdx++] : null;

  return {
    billing: billingRow,
    cogs: cogsRow,
    freight: freightRow,
    sales,
    cogsAmount: cogs,
    freightAmount: freight,
  };
}

// Back-compat wrapper. Older callers expect a single billing transaction.
export async function writeShipmentBilling(args: {
  shipmentId: string;
  userId: string | null;
  now: string;
}): Promise<{ transaction: Transaction; total: number }> {
  const result = await writeShipmentAccruals(args);
  return { transaction: result.billing, total: result.sales };
}

async function upsertAccrual(args: {
  shipment: Shipment;
  kind: AccrualKind;
  amount: number;
  currency: string;
  description: string;
  contactId: string | null;
  date: string;
  userId: string | null;
  now: string;
}): Promise<{ id: string | null; previousAmount: number | null }> {
  const supabase = createClient();
  const existing = await findShipmentTransaction(args.shipment.id, args.kind);

  if (args.amount <= 0) {
    if (existing) {
      const { error } = await supabase
        .from("transactions")
        .delete()
        .eq("id", existing.id);
      if (error) throw error;
    }
    return {
      id: null,
      previousAmount: existing ? Number(existing.amount) : null,
    };
  }

  if (existing) {
    const update: TransactionUpdate = {
      amount: args.amount,
      currency: args.currency,
      description: args.description,
      contact_id: args.contactId,
      edited_by: args.userId,
      edited_time: args.now,
    };
    const { error } = await supabase
      .from("transactions")
      .update(update)
      .eq("id", existing.id);
    if (error) throw error;
    return { id: existing.id, previousAmount: Number(existing.amount) };
  }

  const payload = buildAccrualPayload({
    shipment: args.shipment,
    kind: args.kind,
    amount: args.amount,
    currency: args.currency,
    description: args.description,
    reference: args.shipment.name,
    contactId: args.contactId,
    date: args.date,
    userId: args.userId,
    now: args.now,
  });
  const { data, error } = await supabase
    .from("transactions")
    .insert(payload)
    .select("id")
    .single();
  if (error) throw error;
  return { id: data.id, previousAmount: null };
}

export async function refreshShipmentAccruals(shipmentId: string): Promise<{
  status: ShipmentStatus;
  sales: number;
  cogs: number;
  freight: number;
} | null> {
  const shipment = await loadShipmentForBilling(shipmentId);
  const status = shipment.status as ShipmentStatus;

  if (status === "draft") {
    return { status, sales: 0, cogs: 0, freight: 0 };
  }

  if (status === "arrived") {
    throw new Error(ARRIVED_BLOCK_MESSAGE);
  }

  const userId = await currentUserId();
  const now = new Date().toISOString();
  const today = istanbulToday();

  const lines = await fetchShipmentLines(shipmentId);
  const sales = computeSalesTotal(lines);
  const cogs = computeCogsTotal(lines);
  const freight = Number(shipment.freight_cost ?? 0);

  const billingExisting = await findShipmentTransaction(
    shipmentId,
    "shipment_billing",
  );
  if (!billingExisting) {
    throw new Error(
      `Data integrity: shipment ${shipmentId} is ${status} but has no shipment_billing transaction.`,
    );
  }

  if (sales <= 0) {
    throw new Error(
      "Refreshed sales total is zero. Set unit sales prices on the order lines.",
    );
  }
  await upsertAccrual({
    shipment,
    kind: "shipment_billing",
    amount: sales,
    currency: shipment.invoice_currency,
    description: `Billing for shipment: ${shipment.name}`,
    contactId: shipment.customer_id,
    date: today,
    userId,
    now,
  });
  await upsertAccrual({
    shipment,
    kind: "shipment_cogs",
    amount: cogs,
    currency: shipment.invoice_currency,
    description: `COGS for shipment: ${shipment.name}`,
    contactId: null,
    date: today,
    userId,
    now,
  });
  await upsertAccrual({
    shipment,
    kind: "shipment_freight",
    amount: freight,
    currency: shipment.freight_currency ?? shipment.invoice_currency,
    description: `Freight for shipment: ${shipment.name}`,
    contactId: null,
    date: today,
    userId,
    now,
  });

  return { status, sales, cogs, freight };
}

// Back-compat — still called from updateShipment when freight changes.
export const refreshShipmentBilling = (shipmentId: string) =>
  refreshShipmentAccruals(shipmentId);

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

// Used by mutations.ts during booked → in_transit. Captures the previous state
// of all three accruals so we can roll back if the order cascade fails.
export type AccrualSnapshot = {
  kind: AccrualKind;
  transactionId: string | null;
  previousAmount: number | null;
  previousEdited: { edited_by: string | null; edited_time: string | null };
};

export async function refreshAccrualsForShipmentTransition(args: {
  shipmentId: string;
  userId: string | null;
  now: string;
}): Promise<{
  snapshots: AccrualSnapshot[];
  sales: number;
  cogs: number;
  freight: number;
}> {
  const supabase = createClient();
  const shipment = await loadShipmentForBilling(args.shipmentId);
  const today = istanbulToday();

  const lines = await fetchShipmentLines(args.shipmentId);
  const sales = computeSalesTotal(lines);
  const cogs = computeCogsTotal(lines);
  const freight = Number(shipment.freight_cost ?? 0);

  if (sales <= 0) {
    throw new Error(
      "Cannot move shipment forward with zero sales total.",
    );
  }

  const snapshots: AccrualSnapshot[] = [];
  const captureExisting = async (kind: AccrualKind) => {
    const existing = await findShipmentTransaction(args.shipmentId, kind);
    snapshots.push({
      kind,
      transactionId: existing?.id ?? null,
      previousAmount: existing ? Number(existing.amount) : null,
      previousEdited: {
        edited_by: existing?.edited_by ?? null,
        edited_time: existing?.edited_time ?? null,
      },
    });
  };
  await captureExisting("shipment_billing");
  await captureExisting("shipment_cogs");
  await captureExisting("shipment_freight");

  // Validate billing exists; we keep the same data-integrity rule.
  if (!snapshots[0].transactionId) {
    throw new Error(
      `Data integrity: shipment ${args.shipmentId} has no shipment_billing transaction to refresh.`,
    );
  }

  const billingResult = await upsertAccrual({
    shipment,
    kind: "shipment_billing",
    amount: sales,
    currency: shipment.invoice_currency,
    description: `Billing for shipment: ${shipment.name}`,
    contactId: shipment.customer_id,
    date: today,
    userId: args.userId,
    now: args.now,
  });
  const cogsResult = await upsertAccrual({
    shipment,
    kind: "shipment_cogs",
    amount: cogs,
    currency: shipment.invoice_currency,
    description: `COGS for shipment: ${shipment.name}`,
    contactId: null,
    date: today,
    userId: args.userId,
    now: args.now,
  });
  const freightResult = await upsertAccrual({
    shipment,
    kind: "shipment_freight",
    amount: freight,
    currency: shipment.freight_currency ?? shipment.invoice_currency,
    description: `Freight for shipment: ${shipment.name}`,
    contactId: null,
    date: today,
    userId: args.userId,
    now: args.now,
  });
  // If a kind didn't have a row before but upsertAccrual created one,
  // store the new id on its snapshot so restoreAccrualSnapshots can DELETE
  // the orphan on cascade failure (otherwise it would silently leak).
  const noteCreated = (kind: AccrualKind, newId: string | null) => {
    const s = snapshots.find((x) => x.kind === kind);
    if (s && !s.transactionId && s.previousAmount == null && newId) {
      s.transactionId = newId;
    }
  };
  noteCreated("shipment_billing", billingResult.id);
  noteCreated("shipment_cogs", cogsResult.id);
  noteCreated("shipment_freight", freightResult.id);
  // Acknowledge supabase var is intentionally referenced for any future query.
  void supabase;

  return { snapshots, sales, cogs, freight };
}

// Back-compat alias for older callers.
export const refreshBillingForShipmentTransition = async (args: {
  shipmentId: string;
  userId: string | null;
  now: string;
}) => {
  const result = await refreshAccrualsForShipmentTransition(args);
  const billing = result.snapshots.find((s) => s.kind === "shipment_billing");
  return {
    transactionId: billing?.transactionId ?? "",
    previousAmount: billing?.previousAmount ?? 0,
    previousEdited: billing?.previousEdited ?? {
      edited_by: null,
      edited_time: null,
    },
    newTotal: result.sales,
    snapshots: result.snapshots,
  };
};

export type SnapshotRestoreAction =
  | { type: "noop" }
  | { type: "delete"; id: string }
  | {
      type: "update";
      id: string;
      amount: number;
      edited: { edited_by: string | null; edited_time: string | null };
    };

// Pure: decide what to do with one snapshot on rollback.
// - transactionId null → row never existed and was never created, nothing to do.
// - previousAmount null but transactionId set → row was created during the
//   transition (refreshAccrualsForShipmentTransition writes the new id back
//   into the snapshot), so undo by DELETE.
// - otherwise → row pre-existed, restore prior amount + edited fields.
export function planSnapshotRestore(s: AccrualSnapshot): SnapshotRestoreAction {
  if (!s.transactionId) return { type: "noop" };
  if (s.previousAmount == null) {
    return { type: "delete", id: s.transactionId };
  }
  return {
    type: "update",
    id: s.transactionId,
    amount: s.previousAmount,
    edited: s.previousEdited,
  };
}

export async function restoreAccrualSnapshots(
  snapshots: AccrualSnapshot[],
): Promise<void> {
  const supabase = createClient();
  for (const s of snapshots) {
    const action = planSnapshotRestore(s);
    if (action.type === "noop") continue;
    if (action.type === "delete") {
      const { error } = await supabase
        .from("transactions")
        .delete()
        .eq("id", action.id);
      if (error) throw error;
      continue;
    }
    const { error } = await supabase
      .from("transactions")
      .update({
        amount: action.amount,
        edited_by: action.edited.edited_by,
        edited_time: action.edited.edited_time,
      })
      .eq("id", action.id);
    if (error) throw error;
  }
}

// Back-compat used by mutations.ts old single-billing rollback.
export async function restoreBillingAmount(args: {
  transactionId: string;
  amount: number;
  edited: { edited_by: string | null; edited_time: string | null };
}): Promise<void> {
  if (!args.transactionId) return;
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

// Back-compat — single composite total, kept so any UI piece reading the
// "shipment total" still sees a consistent number. Equals net invoice
// (sales) since freight is now booked separately as expense.
export async function computeShipmentTotal(
  shipmentId: string,
): Promise<number> {
  return computeShipmentSales(shipmentId);
}
