"use client";

import { useMemo } from "react";
import type { PartnerTransactionRow } from "./queries/partner-transactions";
import {
  PartnerLedgerRow,
  partnerRowSignedAmount,
} from "./partner-ledger-row";

export function PartnerLedgerTable({
  rows,
  tallyCurrency,
}: {
  rows: PartnerTransactionRow[];
  tallyCurrency: string;
}) {
  const runningTallies = useMemo(() => {
    const map = new Map<string, number>();
    let running = 0;
    for (const r of rows) {
      if (r.currency === tallyCurrency) {
        running += partnerRowSignedAmount(r);
      }
      map.set(r.id, running);
    }
    return map;
  }, [rows, tallyCurrency]);

  if (rows.length === 0) {
    return (
      <div className="rounded-md border p-8 text-center text-sm text-muted-foreground">
        No transactions yet for this partner.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="min-w-full divide-y text-sm">
        <thead className="bg-muted/50 text-[11px] uppercase text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left">Date</th>
            <th className="px-3 py-2 text-left">Kind</th>
            <th className="px-3 py-2 text-center">Dir</th>
            <th className="px-3 py-2 text-left">Description</th>
            <th className="px-3 py-2 text-left">Account</th>
            <th className="px-3 py-2 text-right">Amount</th>
            <th className="px-3 py-2 text-right">
              Running tally ({tallyCurrency})
            </th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((row) => (
            <PartnerLedgerRow
              key={row.id}
              row={row}
              runningTally={
                row.currency === tallyCurrency
                  ? runningTallies.get(row.id) ?? null
                  : null
              }
              tallyCurrency={tallyCurrency}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
