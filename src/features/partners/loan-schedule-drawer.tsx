"use client";

import { useMemo } from "react";
import { Pencil, ReceiptText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatCurrency } from "@/lib/format-money";
import type { BalanceCurrency } from "@/lib/supabase/types";
import {
  useLoansSummary,
  type LoanInstallmentStatus,
  type LoanState,
} from "./queries/loans";

function formatDate(d: string): string {
  const dt = new Date(d + "T00:00:00");
  return dt.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const STATUS_STYLES: Record<LoanInstallmentStatus, string> = {
  paid: "bg-emerald-500/15 text-emerald-800",
  partial: "bg-amber-500/15 text-amber-800",
  open: "bg-muted text-muted-foreground",
  overdue: "bg-destructive/15 text-destructive",
};

const STATUS_LABEL: Record<LoanInstallmentStatus, string> = {
  paid: "Paid",
  partial: "Partial",
  open: "Open",
  overdue: "Overdue",
};

export function LoanScheduleDrawer({
  open,
  onOpenChange,
  onEditLoan,
  onRepayLoan,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onEditLoan: (loanId: string) => void;
  onRepayLoan: (partnerId: string, currency: BalanceCurrency) => void;
}) {
  const { data, isLoading, isError, error } = useLoansSummary();

  const grouped = useMemo(() => {
    const byPartner = new Map<
      string,
      { partnerName: string; loans: LoanState[] }
    >();
    for (const loan of data?.loans ?? []) {
      const id = loan.partner_id ?? "_";
      const name = loan.partner?.name ?? "Unknown";
      const entry = byPartner.get(id) ?? { partnerName: name, loans: [] };
      entry.loans.push(loan);
      byPartner.set(id, entry);
    }
    return Array.from(byPartner.entries())
      .map(([partnerId, e]) => ({
        partnerId,
        partnerName: e.partnerName,
        loans: e.loans
          .slice()
          .sort((a, b) =>
            a.transaction_date < b.transaction_date ? 1 : -1,
          ),
      }))
      .sort((a, b) => a.partnerName.localeCompare(b.partnerName));
  }, [data]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-2xl overflow-y-auto"
      >
        <SheetHeader>
          <SheetTitle>Loan schedule</SheetTitle>
          <SheetDescription>
            All open and historical loans grouped by partner. Repayments
            consume the oldest open installment first within partner +
            currency.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-6 px-4 pb-6">
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : isError ? (
            <p className="text-sm text-destructive">
              Failed to load: {(error as Error).message}
            </p>
          ) : grouped.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No loans logged yet.
            </p>
          ) : (
            grouped.map((g) => (
              <section key={g.partnerId} className="space-y-3">
                <h3 className="text-sm font-semibold">{g.partnerName}</h3>
                {g.loans.map((loan) => (
                  <div
                    key={loan.id}
                    className="rounded-md border bg-card p-3 space-y-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-base font-semibold tabular-nums">
                          {formatCurrency(
                            Number(loan.amount),
                            loan.currency,
                          )}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {formatDate(loan.transaction_date)} ·{" "}
                          {loan.from_account?.account_name ?? "—"}
                          {loan.description ? ` · ${loan.description}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums ${
                            loan.outstanding > 0.001
                              ? "bg-sky-500/15 text-sky-800"
                              : "bg-emerald-500/15 text-emerald-800"
                          }`}
                        >
                          {loan.outstanding > 0.001
                            ? `${formatCurrency(
                                loan.outstanding,
                                loan.currency,
                              )} outstanding`
                            : "Settled"}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Edit loan"
                          onClick={() => onEditLoan(loan.id)}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            onRepayLoan(
                              loan.partner_id ?? "",
                              loan.currency as BalanceCurrency,
                            )
                          }
                          disabled={!loan.partner_id}
                        >
                          <ReceiptText className="mr-1.5 size-3.5" />
                          Repay
                        </Button>
                      </div>
                    </div>

                    {loan.installment_states.length > 0 ? (
                      <ul className="divide-y rounded-md border text-xs">
                        {loan.installment_states.map((inst) => (
                          <li
                            key={inst.id}
                            className="flex items-center justify-between gap-3 px-3 py-2"
                          >
                            <span className="tabular-nums">
                              {formatDate(inst.due_date)}
                            </span>
                            <span className="flex-1 text-right tabular-nums text-muted-foreground">
                              {inst.paid_amount > 0.001
                                ? `${formatCurrency(
                                    inst.paid_amount,
                                    inst.currency,
                                  )} of `
                                : ""}
                              {formatCurrency(
                                Number(inst.amount),
                                inst.currency,
                              )}
                            </span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                STATUS_STYLES[inst.status]
                              }`}
                            >
                              {STATUS_LABEL[inst.status]}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-[11px] text-muted-foreground">
                        No installment schedule. Total paid:{" "}
                        {formatCurrency(loan.total_paid, loan.currency)}.
                      </p>
                    )}
                  </div>
                ))}
              </section>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
