// Dashboard data composition.
//
// No new SQL: every hook here delegates to existing module queries using
// the same React Query keys, so the dashboard's data is cache-shared with
// /treasury, /shipments, /tax, /partners.
//
// Each card uses its own hook(s) at render time so cards stream
// independently — there is intentionally NO combined "useDashboardData"
// hook here.

"use client";

import { useMemo } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";

import {
  allocateFifo,
  type LedgerEvent,
} from "@/lib/ledger/fifo-allocation";
import {
  listTransactionsForContact,
  transactionKeys,
  type ContactLedgerRow,
} from "@/features/transactions/queries";
import {
  listShipments,
  shipmentKeys,
  type ShipmentListRow,
} from "@/features/shipments/queries";
import { usePartnersWithPendingReimbursements } from "@/features/partners/queries/pending-reimbursements";

function toLedgerEvent(row: ContactLedgerRow): LedgerEvent {
  return {
    id: row.id,
    date: row.transaction_date,
    created_time: row.created_time,
    kind: row.kind as LedgerEvent["kind"],
    amount: Number(row.amount),
    currency: row.currency,
    related_shipment_id: row.related_shipment_id,
    fx_converted_amount:
      row.fx_converted_amount === null ? null : Number(row.fx_converted_amount),
    fx_target_currency: row.fx_target_currency,
  };
}

export type ArOutstandingByCurrency = Map<string, number>;

export type ArOutstandingState = {
  data: ArOutstandingByCurrency | null;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
};

// Card 2 — AR per currency.
//
// Composition: shipments list -> unique customer ids -> per-customer
// transaction fetch (cache-shared with shipment-billing-card via
// transactionKeys.byContact) -> FIFO per (customer, currency) ->
// sum outstanding for non-arrived shipments grouped by invoice_currency.
//
// We intentionally fan out per customer rather than adding a new bulk SQL
// query: existing keys, no new server surface, no cache duplication.
export function useArOutstanding(): ArOutstandingState {
  const shipmentsQ = useQuery({
    queryKey: shipmentKeys.list(),
    queryFn: listShipments,
  });

  const shipments = shipmentsQ.data;

  const customerIds = useMemo(() => {
    if (!shipments) return [];
    const set = new Set<string>();
    for (const s of shipments) {
      if (s.customer_id) set.add(s.customer_id);
    }
    return Array.from(set).sort();
  }, [shipments]);

  const customerLedgerQs = useQueries({
    queries: customerIds.map((id) => ({
      queryKey: transactionKeys.byContact(id),
      queryFn: () => listTransactionsForContact(id),
    })),
  });

  const isLoading =
    shipmentsQ.isLoading || customerLedgerQs.some((q) => q.isLoading);
  const isError =
    shipmentsQ.isError || customerLedgerQs.some((q) => q.isError);

  // Stable signature so the heavy memo below only recomputes when underlying
  // data actually changes — not on every render (tanstack rebuilds the
  // useQueries result array each render even when data is unchanged).
  const ledgerSignature = customerLedgerQs
    .map((q) => `${q.dataUpdatedAt ?? 0}:${q.status}`)
    .join("|");

  const data = useMemo<ArOutstandingByCurrency | null>(() => {
    if (!shipments) return null;
    if (customerIds.length === 0) return new Map();
    if (customerLedgerQs.some((q) => q.isLoading)) return null;

    // Map each non-arrived shipment to (id -> invoice_currency) for the
    // currency-bucket lookup at aggregation time.
    const shipmentCurrencyById = new Map<string, string>();
    for (const s of shipments) {
      if (s.status === "arrived") continue;
      shipmentCurrencyById.set(s.id, s.invoice_currency);
    }
    if (shipmentCurrencyById.size === 0) {
      return new Map();
    }

    const totals = new Map<string, number>();

    for (let i = 0; i < customerIds.length; i += 1) {
      const ledger = customerLedgerQs[i]?.data ?? [];
      // Run FIFO once per currency the customer has activity in. We narrow
      // to currencies actually used in shipment_billing rows so we don't do
      // redundant passes for currencies that only appear on payments.
      const currenciesInUse = new Set<string>();
      for (const row of ledger) {
        if (row.kind === "shipment_billing") currenciesInUse.add(row.currency);
        if (row.fx_target_currency) currenciesInUse.add(row.fx_target_currency);
      }
      if (currenciesInUse.size === 0) continue;

      const events = ledger.map(toLedgerEvent);

      for (const currency of currenciesInUse) {
        const result = allocateFifo(events, currency);
        for (const alloc of result.shipment_allocations) {
          const shipmentCurrency = shipmentCurrencyById.get(
            alloc.related_shipment_id,
          );
          if (!shipmentCurrency) continue;
          if (shipmentCurrency !== currency) continue;
          if (alloc.outstanding_amount <= 0.001) continue;
          totals.set(
            currency,
            (totals.get(currency) ?? 0) + alloc.outstanding_amount,
          );
        }
      }
    }

    return totals;
    // ledgerSignature captures all relevant changes in customerLedgerQs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shipments, customerIds, ledgerSignature]);

  const refetch = () => {
    shipmentsQ.refetch();
    for (const q of customerLedgerQs) q.refetch();
  };

  return { data, isLoading, isError, refetch };
}

// Card 3 — Pending partner reimbursements aggregated per currency
// across all partners.
export function usePendingReimbursementsAggregate() {
  const q = usePartnersWithPendingReimbursements();
  const data = useMemo<ArOutstandingByCurrency | null>(() => {
    if (!q.data) return null;
    const totals = new Map<string, number>();
    for (const row of q.data) {
      for (const bucket of row.pending) {
        totals.set(
          bucket.currency,
          (totals.get(bucket.currency) ?? 0) + bucket.amount,
        );
      }
    }
    return totals;
  }, [q.data]);
  return {
    data,
    isLoading: q.isLoading,
    isError: q.isError,
    refetch: () => q.refetch(),
  };
}

// Re-export types used by snapshot-cards / attention-list.
export type { ShipmentListRow };
