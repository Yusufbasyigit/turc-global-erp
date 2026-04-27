"use client";

import { useState } from "react";
import { CalendarDays, Plus, ReceiptText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency as formatMoney } from "@/lib/format-money";
import type { BalanceCurrency } from "@/lib/supabase/types";
import { useLoansSummary, type LoanWithInstallments } from "./queries/loans";
import { LoanEventDialog } from "./loan-event-dialog";
import {
  LoanRepaymentDialog,
  type LoanRepaymentPrefill,
} from "./loan-repayment-dialog";
import { LoanScheduleDrawer } from "./loan-schedule-drawer";

export function LoansSection() {
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [editingLoan, setEditingLoan] = useState<LoanWithInstallments | null>(
    null,
  );
  const [repayOpen, setRepayOpen] = useState(false);
  const [repayPrefill, setRepayPrefill] =
    useState<LoanRepaymentPrefill | null>(null);

  const { data, isLoading, isError, error } = useLoansSummary();
  const totals = data?.outstandingByCurrency ?? [];

  const openLogDialog = () => {
    setEditingLoan(null);
    setEventDialogOpen(true);
  };

  const openEditFromDrawer = (loanId: string) => {
    const loan = data?.loans.find((l) => l.id === loanId) ?? null;
    if (!loan) return;
    setEditingLoan(loan);
    setEventDialogOpen(true);
  };

  const openRepay = (prefill?: LoanRepaymentPrefill | null) => {
    setRepayPrefill(prefill ?? null);
    setRepayOpen(true);
  };

  return (
    <section className="flex flex-col gap-2 border-y border-border py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 min-w-0">
        <span className="text-sm font-medium">Loans outstanding</span>
        {isLoading ? (
          <Skeleton className="h-5 w-40" />
        ) : isError ? (
          <span className="text-sm text-destructive">
            Failed to load: {(error as Error).message}
          </span>
        ) : totals.length === 0 ? (
          <span className="text-sm text-muted-foreground">
            None outstanding
          </span>
        ) : (
          totals.map((t) => (
            <span
              key={t.currency}
              className="flex items-baseline gap-3 text-sm tabular-nums"
            >
              <span className="text-muted-foreground/60">·</span>
              <span className="font-medium">
                {formatMoney(t.amount, t.currency)}
              </span>
            </span>
          ))
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setScheduleOpen(true)}
        >
          <CalendarDays className="mr-2 size-4" />
          Schedule
        </Button>
        <Button variant="outline" size="sm" onClick={() => openRepay(null)}>
          <ReceiptText className="mr-2 size-4" />
          Record repayment
        </Button>
        <Button size="sm" onClick={openLogDialog}>
          <Plus className="mr-2 size-4" />
          Log loan
        </Button>
      </div>

      <LoanScheduleDrawer
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
        onEditLoan={(id) => {
          setScheduleOpen(false);
          openEditFromDrawer(id);
        }}
        onRepayLoan={(partnerId, currency: BalanceCurrency) => {
          setScheduleOpen(false);
          openRepay({ partner_id: partnerId, currency });
        }}
      />

      <LoanEventDialog
        open={eventDialogOpen}
        onOpenChange={setEventDialogOpen}
        loan={editingLoan}
      />

      <LoanRepaymentDialog
        open={repayOpen}
        onOpenChange={setRepayOpen}
        prefill={repayPrefill}
      />
    </section>
  );
}
