"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { subMonths, formatISO } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  allocateFifo,
  type LedgerEvent,
  type PaymentAllocationDetail,
} from "@/lib/ledger/fifo-allocation";
import {
  listTransactionsForContact,
  transactionKeys,
  type ContactLedgerRow,
} from "@/features/transactions/queries";
import { getContact, contactKeys } from "./queries";
import { LedgerRow } from "./ledger-row";
import { LedgerFilters, type LedgerFilterState } from "./ledger-filters";
import { LedgerHeader } from "./ledger-header";

function toLedgerEvent(row: ContactLedgerRow): LedgerEvent {
  return {
    id: row.id,
    date: row.transaction_date,
    kind: row.kind as LedgerEvent["kind"],
    amount: Number(row.amount),
    currency: row.currency,
    related_shipment_id: row.related_shipment_id,
    fx_converted_amount:
      row.fx_converted_amount === null ? null : Number(row.fx_converted_amount),
    fx_target_currency: row.fx_target_currency,
  };
}

function effectiveSigned(
  row: ContactLedgerRow,
  displayCurrency: string,
): number | null {
  let effective: number | null = null;
  if (
    row.fx_target_currency === displayCurrency &&
    row.fx_converted_amount !== null
  ) {
    effective = Number(row.fx_converted_amount);
  } else if (row.currency === displayCurrency) {
    effective = Number(row.amount);
  }
  if (effective === null) return null;
  if (row.kind === "shipment_billing") return effective;
  if (row.kind === "client_payment") return -effective;
  if (row.kind === "client_refund") return effective;
  return 0;
}

const EMPTY_ALLOCATIONS: readonly PaymentAllocationDetail[] = [];

const initialFilters = (): LedgerFilterState => ({
  fromDate: formatISO(subMonths(new Date(), 12), { representation: "date" }),
  toDate: formatISO(new Date(), { representation: "date" }),
  kinds: [],
  shipmentIds: [],
});

export function ContactLedgerSection({ contactId }: { contactId: string }) {
  const [filters, setFilters] = useState<LedgerFilterState>(initialFilters);

  const contactQ = useQuery({
    queryKey: contactKeys.detail(contactId),
    queryFn: () => getContact(contactId),
  });
  const ledgerQ = useQuery({
    queryKey: transactionKeys.byContact(contactId),
    queryFn: () => listTransactionsForContact(contactId),
  });

  const displayCurrency = contactQ.data?.balance_currency ?? "USD";

  const fifo = useMemo(() => {
    const events = (ledgerQ.data ?? []).map(toLedgerEvent);
    return allocateFifo(events, displayCurrency);
  }, [ledgerQ.data, displayCurrency]);

  const rowsInOrder = useMemo(() => ledgerQ.data ?? [], [ledgerQ.data]);

  const skippedIds = useMemo(
    () => new Set(fifo.skipped_events.map((s) => s.event.id)),
    [fifo],
  );

  const allocationsByBilling = useMemo(() => {
    const map = new Map<string, PaymentAllocationDetail[]>();
    for (const a of fifo.payment_allocations) {
      const list = map.get(a.shipment_billing_id);
      if (list) list.push(a);
      else map.set(a.shipment_billing_id, [a]);
    }
    return map;
  }, [fifo]);

  const { runningBalances, signedByRow } = useMemo(() => {
    const balances = new Map<string, number>();
    const signed = new Map<string, number | null>();
    let running = 0;
    for (const r of rowsInOrder) {
      const s = effectiveSigned(r, displayCurrency);
      signed.set(r.id, s);
      if (skippedIds.has(r.id) || r.kind === "adjustment" || s === null) {
        balances.set(r.id, running);
        continue;
      }
      running += s;
      balances.set(r.id, running);
    }
    return { runningBalances: balances, signedByRow: signed };
  }, [rowsInOrder, skippedIds, displayCurrency]);

  const shipmentOptions = useMemo(() => {
    const seen = new Map<string, string | null>();
    for (const r of rowsInOrder) {
      if (r.related_shipment && !seen.has(r.related_shipment.id)) {
        seen.set(r.related_shipment.id, r.related_shipment.name);
      }
    }
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  }, [rowsInOrder]);

  const visibleRows = useMemo(
    () =>
      rowsInOrder.filter((r) => {
        if (r.transaction_date < filters.fromDate) return false;
        if (r.transaction_date > filters.toDate) return false;
        if (filters.kinds.length > 0 && !filters.kinds.includes(r.kind))
          return false;
        if (
          filters.shipmentIds.length > 0 &&
          (!r.related_shipment_id ||
            !filters.shipmentIds.includes(r.related_shipment_id))
        )
          return false;
        return true;
      }),
    [rowsInOrder, filters],
  );

  if (contactQ.isLoading || ledgerQ.isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ledger</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Ledger</CardTitle>
        <p className="text-xs text-muted-foreground">
          Chronological billings and payments in {displayCurrency}.
        </p>
      </CardHeader>
      <CardContent className="space-y-4 pb-4">
        <LedgerHeader fifo={fifo} displayCurrency={displayCurrency} />

        <LedgerFilters
          state={filters}
          shipmentOptions={shipmentOptions}
          onChange={setFilters}
          onReset={() => setFilters(initialFilters())}
        />

        {visibleRows.length === 0 ? (
          <div className="rounded-md border p-8 text-center text-sm text-muted-foreground">
            No transactions in the selected range.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <table className="min-w-full divide-y text-sm">
              <thead className="bg-muted/50 text-[11px] uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-left">Event</th>
                  <th className="px-3 py-2 text-left">Reference</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                  <th className="px-3 py-2 text-right">Running balance</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {visibleRows.map((row) => (
                  <LedgerRow
                    key={row.id}
                    row={row}
                    signedAmount={signedByRow.get(row.id) ?? null}
                    runningBalance={runningBalances.get(row.id) ?? null}
                    skipped={skippedIds.has(row.id)}
                    displayCurrency={displayCurrency}
                    allocations={allocationsByBilling.get(row.id) ?? EMPTY_ALLOCATIONS}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
