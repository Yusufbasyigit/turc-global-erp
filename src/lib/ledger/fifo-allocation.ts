export type LedgerEventKind =
  | "shipment_billing"
  | "client_payment"
  | "client_refund";

export type LedgerEvent = {
  id: string;
  date: string;
  // created_time is the secondary sort key when two events share a
  // transaction_date. Falls back to id-lex if absent. Without it,
  // same-day billings sort by random UUID, which can mis-attribute
  // payments to the wrong bill.
  created_time?: string | null;
  kind: LedgerEventKind;
  amount: number;
  currency: string;
  related_shipment_id: string | null;
  fx_converted_amount: number | null;
  fx_target_currency: string | null;
};

export type ShipmentAllocation = {
  shipment_billing_id: string;
  related_shipment_id: string;
  billed_amount: number;
  paid_amount: number;
  outstanding_amount: number;
  is_fully_paid: boolean;
};

export type PaymentAllocationDetail = {
  payment_event_id: string;
  payment_date: string;
  shipment_billing_id: string;
  related_shipment_id: string;
  allocated_amount: number;
};

export type SkippedReason = "no_fx" | "missing_shipment";
export type SkippedEvent = { event: LedgerEvent; reason: SkippedReason };

export type LedgerAllocationResult = {
  shipment_allocations: ShipmentAllocation[];
  payment_allocations: PaymentAllocationDetail[];
  unallocated_credit: number;
  total_billed: number;
  total_paid: number;
  net_balance: number;
  skipped_events: SkippedEvent[];
};

export function effectiveAmount(
  event: Pick<
    LedgerEvent,
    "amount" | "currency" | "fx_converted_amount" | "fx_target_currency"
  >,
  displayCurrency: string,
): number | null {
  if (
    event.fx_target_currency === displayCurrency &&
    event.fx_converted_amount !== null &&
    event.fx_converted_amount !== undefined
  ) {
    return Number(event.fx_converted_amount);
  }
  if (event.currency === displayCurrency) {
    return Number(event.amount);
  }
  return null;
}

export function effectiveSignedForKind(
  event: Pick<
    LedgerEvent,
    "kind" | "amount" | "currency" | "fx_converted_amount" | "fx_target_currency"
  >,
  displayCurrency: string,
): number | null {
  const eff = effectiveAmount(event, displayCurrency);
  if (eff === null) return null;
  if (event.kind === "shipment_billing" || event.kind === "client_refund")
    return eff;
  if (event.kind === "client_payment") return -eff;
  return 0;
}

type BillingSlot = {
  event: LedgerEvent;
  billed: number;
  paid: number;
};

export function allocateFifo(
  events: LedgerEvent[],
  displayCurrency: string,
): LedgerAllocationResult {
  const sorted = [...events].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    const at = a.created_time ?? "";
    const bt = b.created_time ?? "";
    if (at !== bt) return at < bt ? -1 : 1;
    if (a.id !== b.id) return a.id < b.id ? -1 : 1;
    return 0;
  });

  const skipped: SkippedEvent[] = [];
  const billings: BillingSlot[] = [];
  const paymentAllocations: PaymentAllocationDetail[] = [];
  // Prepayments (and any unallocated remainder of a partial payment) sit here
  // until a billing slot opens. We keep the originating event so the
  // retroactive-match loop below can still emit payment_allocations entries
  // linking the prepayment to the billing it funded.
  const pendingCredits: Array<{ event: LedgerEvent; remaining: number }> = [];

  for (const event of sorted) {
    const amt = effectiveAmount(event, displayCurrency);
    if (amt === null) {
      skipped.push({ event, reason: "no_fx" });
      continue;
    }

    if (event.kind === "shipment_billing") {
      if (!event.related_shipment_id) {
        skipped.push({ event, reason: "missing_shipment" });
        continue;
      }
      billings.push({ event, billed: amt, paid: 0 });
      continue;
    }

    if (event.kind === "client_payment") {
      let remaining = amt;
      for (const slot of billings) {
        if (remaining <= 0) break;
        const capacity = slot.billed - slot.paid;
        if (capacity <= 0) continue;
        const take = Math.min(capacity, remaining);
        slot.paid += take;
        remaining -= take;
        paymentAllocations.push({
          payment_event_id: event.id,
          payment_date: event.date,
          shipment_billing_id: slot.event.id,
          related_shipment_id: slot.event.related_shipment_id!,
          allocated_amount: take,
        });
      }
      if (remaining > 0) pendingCredits.push({ event, remaining });
      continue;
    }

    if (event.kind === "client_refund") {
      let remaining = amt;
      while (remaining > 0 && pendingCredits.length > 0) {
        const head = pendingCredits[0];
        const take = Math.min(head.remaining, remaining);
        head.remaining -= take;
        remaining -= take;
        if (head.remaining <= 0) pendingCredits.shift();
      }
      for (let i = billings.length - 1; i >= 0 && remaining > 0; i--) {
        const slot = billings[i];
        if (slot.paid <= 0) continue;
        const take = Math.min(slot.paid, remaining);
        slot.paid -= take;
        remaining -= take;
      }
      continue;
    }

  }

  // Retroactive match: a payment that arrived before any billing is parked in
  // pendingCredits. Once a later billing slot opens with paid < billed, drain
  // the oldest credits into that slot FIFO and emit payment_allocations so
  // downstream views (per-shipment "Payments applied" table, customer
  // statement PDF) can still attribute the funding back to the prepayment.
  for (const slot of billings) {
    while (slot.billed - slot.paid > 0 && pendingCredits.length > 0) {
      const head = pendingCredits[0];
      const capacity = slot.billed - slot.paid;
      const take = Math.min(capacity, head.remaining);
      slot.paid += take;
      head.remaining -= take;
      paymentAllocations.push({
        payment_event_id: head.event.id,
        payment_date: head.event.date,
        shipment_billing_id: slot.event.id,
        related_shipment_id: slot.event.related_shipment_id!,
        allocated_amount: take,
      });
      if (head.remaining <= 0) pendingCredits.shift();
    }
  }

  const unallocatedCredit = pendingCredits.reduce(
    (s, c) => s + c.remaining,
    0,
  );

  const shipment_allocations: ShipmentAllocation[] = billings.map((slot) => {
    const outstanding = Math.max(0, slot.billed - slot.paid);
    return {
      shipment_billing_id: slot.event.id,
      related_shipment_id: slot.event.related_shipment_id!,
      billed_amount: slot.billed,
      paid_amount: slot.paid,
      outstanding_amount: outstanding,
      is_fully_paid: slot.paid >= slot.billed,
    };
  });

  const total_billed = billings.reduce((s, b) => s + b.billed, 0);
  const allocated_paid = billings.reduce((s, b) => s + b.paid, 0);
  // Total paid is what the customer has handed us — both the portion FIFO'd
  // onto a billing and any leftover sitting as unallocated credit. Net
  // balance must subtract both so an overpaid ledger reads as "we owe them"
  // instead of falsely "settled".
  const total_paid = allocated_paid + unallocatedCredit;
  const net_balance = total_billed - total_paid;

  return {
    shipment_allocations,
    payment_allocations: paymentAllocations,
    unallocated_credit: unallocatedCredit,
    total_billed,
    total_paid,
    net_balance,
    skipped_events: skipped,
  };
}
