"use client";

import { useMemo } from "react";
import type {
  LedgerAllocationResult,
  PaymentAllocationDetail,
} from "@/lib/ledger/fifo-allocation";
import type { ContactLedgerRow } from "@/features/transactions/queries";
import { formatDateOnly } from "@/lib/format-date";

function formatMoney(n: number): string {
  return Number(n).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

const formatDate = (d: string | null) => formatDateOnly(d);

export function PaymentsAppliedTable({
  shipmentBillingId,
  fifo,
  ledgerRows,
  displayCurrency,
}: {
  shipmentBillingId: string;
  fifo: LedgerAllocationResult;
  ledgerRows: ContactLedgerRow[];
  displayCurrency: string;
}) {
  const rowsById = useMemo(
    () => new Map(ledgerRows.map((r) => [r.id, r])),
    [ledgerRows],
  );

  const { hereEntries, totalByPayment, otherShipmentsByPayment } = useMemo(() => {
    const here = new Map<string, PaymentAllocationDetail>();
    const total = new Map<string, number>();
    const others = new Map<
      string,
      Array<{ related_shipment_id: string; amount: number }>
    >();

    for (const alloc of fifo.payment_allocations) {
      total.set(
        alloc.payment_event_id,
        (total.get(alloc.payment_event_id) ?? 0) + alloc.allocated_amount,
      );
      if (alloc.shipment_billing_id === shipmentBillingId) {
        here.set(alloc.payment_event_id, alloc);
      } else {
        const list = others.get(alloc.payment_event_id);
        if (list) {
          list.push({
            related_shipment_id: alloc.related_shipment_id,
            amount: alloc.allocated_amount,
          });
        } else {
          others.set(alloc.payment_event_id, [
            {
              related_shipment_id: alloc.related_shipment_id,
              amount: alloc.allocated_amount,
            },
          ]);
        }
      }
    }

    const sorted = Array.from(here.entries()).sort((a, b) => {
      const da = a[1].payment_date;
      const db = b[1].payment_date;
      return da < db ? -1 : da > db ? 1 : 0;
    });

    return {
      hereEntries: sorted,
      totalByPayment: total,
      otherShipmentsByPayment: others,
    };
  }, [fifo, shipmentBillingId]);

  if (hereEntries.length === 0) {
    return (
      <div className="rounded-md border p-3 text-xs text-muted-foreground">
        No payments have been applied to this shipment yet.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="min-w-full divide-y text-sm">
        <thead className="bg-muted/50 text-[11px] uppercase text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left">Date</th>
            <th className="px-3 py-2 text-left">Reference</th>
            <th className="px-3 py-2 text-right">Payment amount</th>
            <th className="px-3 py-2 text-right">Applied here</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {hereEntries.map(([paymentId, alloc]) => {
            const row = rowsById.get(paymentId);
            const totalApplied = totalByPayment.get(paymentId) ?? 0;
            const others = otherShipmentsByPayment.get(paymentId) ?? [];
            const tooltipLines: string[] = [];
            if (others.length > 0) {
              tooltipLines.push(
                `This payment applied ${formatMoney(alloc.allocated_amount)} ${displayCurrency} to this shipment.`,
              );
              for (const o of others) {
                tooltipLines.push(
                  `${formatMoney(o.amount)} ${displayCurrency} applied to shipment ${o.related_shipment_id.slice(0, 8)}.`,
                );
              }
            }
            return (
              <tr key={paymentId} className="hover:bg-muted/30">
                <td className="px-3 py-2 text-xs tabular-nums">
                  {formatDate(alloc.payment_date)}
                </td>
                <td className="px-3 py-2 text-xs">
                  {row?.reference_number ?? row?.description ?? "—"}
                </td>
                <td className="px-3 py-2 text-right text-xs tabular-nums">
                  {row ? formatMoney(Number(row.amount)) : "—"}{" "}
                  {row?.currency ?? ""}
                  {row &&
                  row.fx_target_currency === displayCurrency &&
                  row.currency !== displayCurrency ? (
                    <span className="block text-[10px] text-muted-foreground">
                      = {formatMoney(Number(row.fx_converted_amount ?? 0))}{" "}
                      {displayCurrency}
                    </span>
                  ) : null}
                </td>
                <td
                  className="px-3 py-2 text-right text-xs tabular-nums"
                  title={tooltipLines.join("\n")}
                >
                  <span className="font-medium text-emerald-300">
                    {formatMoney(alloc.allocated_amount)} {displayCurrency}
                  </span>
                  {others.length > 0 ? (
                    <span className="block text-[10px] text-muted-foreground">
                      of {formatMoney(totalApplied)} total
                    </span>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
