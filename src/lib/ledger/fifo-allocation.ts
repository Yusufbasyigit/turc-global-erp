export type LedgerEventKind =
  | "shipment_billing"
  | "client_payment"
  | "client_refund"
  | "adjustment";

export type LedgerEvent = {
  id: string;
  date: string;
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

export type SkippedEvent = { event: LedgerEvent; reason: string };

export type LedgerAllocationResult = {
  shipment_allocations: ShipmentAllocation[];
  payment_allocations: PaymentAllocationDetail[];
  unallocated_credit: number;
  total_billed: number;
  total_paid: number;
  net_balance: number;
  skipped_events: SkippedEvent[];
  standalone_adjustments: LedgerEvent[];
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
    if (a.id !== b.id) return a.id < b.id ? -1 : 1;
    return 0;
  });

  const skipped: SkippedEvent[] = [];
  const adjustments: LedgerEvent[] = [];
  const billings: BillingSlot[] = [];
  const paymentAllocations: PaymentAllocationDetail[] = [];
  let unallocatedCredit = 0;

  for (const event of sorted) {
    const amt = effectiveAmount(event, displayCurrency);
    if (amt === null) {
      skipped.push({
        event,
        reason: "currency mismatch, no frozen conversion available",
      });
      continue;
    }

    if (event.kind === "shipment_billing") {
      if (!event.related_shipment_id) {
        skipped.push({
          event,
          reason: "shipment_billing event has no related_shipment_id",
        });
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
      if (remaining > 0) unallocatedCredit += remaining;
      continue;
    }

    if (event.kind === "client_refund") {
      let remaining = amt;
      const fromCredit = Math.min(remaining, unallocatedCredit);
      unallocatedCredit -= fromCredit;
      remaining -= fromCredit;
      for (let i = billings.length - 1; i >= 0 && remaining > 0; i--) {
        const slot = billings[i];
        if (slot.paid <= 0) continue;
        const take = Math.min(slot.paid, remaining);
        slot.paid -= take;
        remaining -= take;
      }
      continue;
    }

    if (event.kind === "adjustment") {
      adjustments.push(event);
      continue;
    }
  }

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
    standalone_adjustments: adjustments,
  };
}
