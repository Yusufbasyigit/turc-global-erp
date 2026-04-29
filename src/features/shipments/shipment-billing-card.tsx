"use client";

import { memo, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
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
  computeShipmentTotal,
  findShipmentBillingTransaction,
  shipmentKeys,
} from "./queries";
import { ShipmentBillingBreakdown } from "./shipment-billing-breakdown";
import { formatDateOnly } from "@/lib/format-date";

function formatMoney(n: number): string {
  return Number(n).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

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

function ShipmentBillingCardImpl({
  shipmentId,
  customerId,
  currency,
}: {
  shipmentId: string;
  customerId: string | null;
  currency: string;
}) {
  const totalQ = useQuery({
    queryKey: shipmentKeys.billingTotal(shipmentId),
    queryFn: () => computeShipmentTotal(shipmentId),
  });
  const txnQ = useQuery({
    queryKey: shipmentKeys.billingTxn(shipmentId),
    queryFn: () => findShipmentBillingTransaction(shipmentId),
  });
  const ledgerQ = useQuery({
    queryKey: transactionKeys.byContact(customerId ?? ""),
    queryFn: () => listTransactionsForContact(customerId ?? ""),
    enabled: Boolean(customerId),
  });

  const liveTotal = totalQ.data ?? 0;
  const txn = txnQ.data ?? null;
  const billedAmount = txn ? Number(txn.amount) : null;
  // Compare currencies first so a mismatched txn currency is always flagged
  // as stale (don't compare amounts denominated in different currencies).
  const isStale =
    txn !== null &&
    billedAmount !== null &&
    (txn.currency !== currency ||
      Math.abs(billedAmount - Number(liveTotal)) > 0.005);

  const ledgerEvents = useMemo(
    () => ledgerQ.data?.map(toLedgerEvent) ?? null,
    [ledgerQ.data],
  );

  const fifo = useMemo(() => {
    if (!ledgerEvents || !txn) return null;
    return allocateFifo(ledgerEvents, currency);
  }, [ledgerEvents, txn, currency]);

  const thisAllocation = useMemo(() => {
    if (!fifo || !txn) return null;
    return (
      fifo.shipment_allocations.find((a) => a.shipment_billing_id === txn.id) ??
      null
    );
  }, [fifo, txn]);

  return (
    <section className="rounded-lg border p-4">
      <h2 className="mb-3 text-sm font-medium">Billing summary</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <div className="text-[11px] uppercase text-muted-foreground">
            Shipment total
          </div>
          {totalQ.isLoading ? (
            <Skeleton className="mt-1 h-6 w-32" />
          ) : (
            <div className="mt-1 text-base font-semibold tabular-nums">
              {formatMoney(liveTotal)} {currency}
            </div>
          )}
          <p className="mt-1 text-[11px] text-muted-foreground">
            Goods (line totals on this shipment). Freight is booked
            separately as an expense at booking.
          </p>
        </div>
        <div>
          <div className="text-[11px] uppercase text-muted-foreground">
            Customer ledger
          </div>
          {txnQ.isLoading ? (
            <Skeleton className="mt-1 h-6 w-48" />
          ) : txn ? (
            <div className="mt-1 text-sm">
              <span className="font-medium text-emerald-700">✓ Billed</span>{" "}
              <span className="tabular-nums">
                {formatMoney(billedAmount ?? 0)} {txn.currency}
              </span>{" "}
              <span className="text-muted-foreground">
                on {formatDateOnly(txn.transaction_date)}
              </span>
            </div>
          ) : (
            <div className="mt-1 text-sm text-muted-foreground">
              Not yet billed
            </div>
          )}
        </div>
      </div>

      {isStale ? (
        <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">
          Billing amount is stale (ledger shows{" "}
          {formatMoney(billedAmount ?? 0)} {txn?.currency}, live total is{" "}
          {formatMoney(liveTotal)} {currency}). Advance to &quot;in transit&quot;
          to refresh, or edit a line to trigger a refresh.
        </div>
      ) : null}

      {txn && thisAllocation && fifo ? (
        <ShipmentBillingBreakdown
          txn={txn}
          allocation={thisAllocation}
          fifo={fifo}
          ledgerRows={ledgerQ.data ?? []}
          currency={currency}
        />
      ) : null}
    </section>
  );
}

export const ShipmentBillingCard = memo(ShipmentBillingCardImpl);
