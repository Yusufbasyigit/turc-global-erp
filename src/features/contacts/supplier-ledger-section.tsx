"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format-money";
import {
  computeOutstandingByInvoice,
  listTransactionsForSupplier,
  transactionKeys,
} from "@/features/transactions/queries";
import { getContact, contactKeys } from "./queries";

const formatMoney = formatCurrency;

type InvoiceStatus = "paid" | "partial" | "open";

function statusFor(
  amount: number,
  outstanding: number,
): InvoiceStatus {
  if (outstanding <= 0.0001) return "paid";
  if (outstanding < amount - 0.0001) return "partial";
  return "open";
}

const STATUS_LABEL: Record<InvoiceStatus, string> = {
  paid: "Fully paid",
  partial: "Partially paid",
  open: "Open",
};

const STATUS_CLASSES: Record<InvoiceStatus, string> = {
  paid: "border-transparent bg-emerald-500/15 text-emerald-300",
  partial: "border-transparent bg-amber-500/15 text-amber-300",
  open: "border-transparent bg-sky-500/15 text-sky-300",
};

export function SupplierLedgerSection({ contactId }: { contactId: string }) {
  const contactQ = useQuery({
    queryKey: contactKeys.detail(contactId),
    queryFn: () => getContact(contactId),
  });
  const ledgerQ = useQuery({
    queryKey: transactionKeys.bySupplier(contactId),
    queryFn: () => listTransactionsForSupplier(contactId),
  });

  const displayCurrency = contactQ.data?.balance_currency ?? "USD";
  const invoices = useMemo(() => ledgerQ.data?.invoices ?? [], [ledgerQ.data]);
  const payments = useMemo(() => ledgerQ.data?.payments ?? [], [ledgerQ.data]);

  const outstandingMap = useMemo(
    () => computeOutstandingByInvoice(invoices, payments),
    [invoices, payments],
  );

  const summary = useMemo(() => {
    let invoiced = 0;
    let paid = 0;
    let excluded = 0;
    for (const inv of invoices) {
      if (inv.currency !== displayCurrency) {
        excluded += 1;
        continue;
      }
      invoiced += Number(inv.amount);
    }
    for (const p of payments) {
      if (p.currency !== displayCurrency) {
        excluded += 1;
        continue;
      }
      paid += Number(p.amount);
    }
    return {
      invoiced,
      paid,
      net: invoiced - paid,
      excluded,
    };
  }, [invoices, payments, displayCurrency]);

  if (contactQ.isLoading || ledgerQ.isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Supplier ledger</CardTitle>
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
        <CardTitle className="text-base">Supplier ledger</CardTitle>
        <p className="text-xs text-muted-foreground">
          Invoices and payments in {displayCurrency}.
        </p>
      </CardHeader>
      <CardContent className="space-y-4 pb-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <SummaryTile
            label="Total invoiced"
            value={formatMoney(summary.invoiced, displayCurrency)}
          />
          <SummaryTile
            label="Total paid"
            value={formatMoney(summary.paid, displayCurrency)}
          />
          <SummaryTile
            label="Net outstanding"
            value={formatMoney(summary.net, displayCurrency)}
            emphasize={summary.net > 0.0001}
          />
        </div>

        {summary.excluded > 0 ? (
          <p className="text-xs text-amber-400">
            Mixed currencies — {summary.excluded} row
            {summary.excluded === 1 ? "" : "s"} excluded from totals.
          </p>
        ) : null}

        <div>
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Invoices
          </h3>
          {invoices.length === 0 ? (
            <div className="rounded-md border p-6 text-center text-sm text-muted-foreground">
              No invoices recorded.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="min-w-full divide-y text-sm">
                <thead className="bg-muted/50 text-[11px] uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left">Date</th>
                    <th className="px-3 py-2 text-left">Reference</th>
                    <th className="px-3 py-2 text-right">Amount</th>
                    <th className="px-3 py-2 text-right">Outstanding</th>
                    <th className="px-3 py-2 text-left">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {invoices.map((inv) => {
                    const outstanding = outstandingMap.get(inv.id) ?? 0;
                    const amount = Number(inv.amount);
                    const status = statusFor(amount, outstanding);
                    return (
                      <tr key={inv.id} className="hover:bg-muted/30">
                        <td className="px-3 py-2 whitespace-nowrap">
                          {format(parseISO(inv.transaction_date), "PP")}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs">
                          {inv.reference_number ?? "—"}
                        </td>
                        <td className="px-3 py-2 text-right font-medium tabular-nums">
                          {formatMoney(amount, inv.currency)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {formatMoney(outstanding, inv.currency)}
                        </td>
                        <td className="px-3 py-2">
                          <Badge
                            className={cn(
                              "text-[10px]",
                              STATUS_CLASSES[status],
                            )}
                          >
                            {STATUS_LABEL[status]}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div>
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Payments
          </h3>
          {payments.length === 0 ? (
            <div className="rounded-md border p-6 text-center text-sm text-muted-foreground">
              No payments recorded.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="min-w-full divide-y text-sm">
                <thead className="bg-muted/50 text-[11px] uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left">Date</th>
                    <th className="px-3 py-2 text-right">Amount</th>
                    <th className="px-3 py-2 text-left">Linked invoice</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {payments.map((p) => (
                    <tr key={p.id} className="hover:bg-muted/30">
                      <td className="px-3 py-2 whitespace-nowrap">
                        {format(parseISO(p.transaction_date), "PP")}
                      </td>
                      <td className="px-3 py-2 text-right font-medium tabular-nums">
                        {formatMoney(Number(p.amount), p.currency)}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">
                        {p.related_payable?.reference_number ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function SummaryTile({
  label,
  value,
  emphasize = false,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1 text-lg font-semibold tabular-nums",
          emphasize && "text-amber-300",
        )}
      >
        {value}
      </p>
    </div>
  );
}
