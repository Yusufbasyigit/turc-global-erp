"use client";

import { useMemo, useState } from "react";
import { Plus, ReceiptText, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/format-money";
import { formatDateOnly } from "@/lib/format-date";
import { todayDateString } from "@/features/treasury/fx-utils";
import { useDealStates, type DealState } from "./queries";
import { DealFormDialog } from "./deal-form-dialog";
import {
  ReceiptFormDialog,
  type ReceiptPrefill,
} from "./receipt-form-dialog";
import { InstallmentRow } from "./installment-row";

function dealStatus(deal: DealState): {
  label: string;
  className: string;
} {
  const today = todayDateString();
  const inst = deal.allocation.installments;
  const allPaid = inst.every((i) => i.status === "paid");
  if (allPaid) {
    return {
      label: "Settled",
      className: "bg-emerald-100 text-emerald-900 border-emerald-200",
    };
  }
  const anyOverdue = inst.some(
    (i) => i.status === "overdue" || (i.due_date < today && i.outstanding > 0.001),
  );
  if (anyOverdue) {
    return {
      label: "Overdue",
      className: "bg-destructive/10 text-destructive border-destructive/30",
    };
  }
  const anyPartial = inst.some((i) => i.status === "partial");
  if (anyPartial) {
    return {
      label: "Active · partial",
      className: "bg-amber-100 text-amber-900 border-amber-200",
    };
  }
  return { label: "Active", className: "" };
}

function DealCard({
  deal,
  onEdit,
  onRecord,
}: {
  deal: DealState;
  onEdit: (deal: DealState) => void;
  onRecord: (deal: DealState) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const status = dealStatus(deal);
  const totalExpected = deal.allocation.total_expected;
  const totalPaid = deal.allocation.total_paid;
  const totalOut = deal.allocation.total_outstanding;

  return (
    <div className="rounded-md border bg-card">
      <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2 min-w-0">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="mt-0.5 text-muted-foreground hover:text-foreground"
            aria-label={expanded ? "Collapse" : "Expand"}
          >
            {expanded ? (
              <ChevronDown className="size-4" />
            ) : (
              <ChevronRight className="size-4" />
            )}
          </button>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium truncate">{deal.label}</span>
              <Badge variant="outline" className="capitalize">
                {deal.sub_type}
              </Badge>
              <Badge variant="outline" className={status.className}>
                {status.label}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground truncate">
              {deal.contact?.company_name ?? "—"} · started{" "}
              {formatDateOnly(deal.start_date)}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 sm:gap-5 text-sm shrink-0">
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Outstanding</p>
            <p className="font-medium tabular-nums">
              {formatCurrency(totalOut, deal.currency)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Paid</p>
            <p className="tabular-nums text-muted-foreground">
              {formatCurrency(totalPaid, deal.currency)} /{" "}
              {formatCurrency(totalExpected, deal.currency)}
            </p>
          </div>
          <div className="flex gap-1">
            <Button size="sm" variant="outline" onClick={() => onEdit(deal)}>
              Edit
            </Button>
            <Button size="sm" onClick={() => onRecord(deal)}>
              Record
            </Button>
          </div>
        </div>
      </div>
      {expanded ? (
        <div className="border-t bg-muted/30">
          <div className="grid grid-cols-[80px_1fr_120px_120px_90px] gap-3 px-2 py-1.5 text-xs uppercase tracking-wide text-muted-foreground border-b">
            <span>#</span>
            <span>Due</span>
            <span className="text-right">Expected</span>
            <span className="text-right">Outstanding</span>
            <span className="justify-self-end">Status</span>
          </div>
          {deal.allocation.installments.map((s) => (
            <InstallmentRow
              key={s.installment_id}
              state={s}
              currency={deal.currency}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function PendingReceiptsStrip({
  deals,
  onPay,
}: {
  deals: DealState[];
  onPay: (dealId: string) => void;
}) {
  const upcoming = useMemo(() => {
    const today = todayDateString();
    const rows: Array<{
      key: string;
      deal: DealState;
      due_date: string;
      outstanding: number;
      isOverdue: boolean;
    }> = [];
    for (const d of deals) {
      for (const i of d.allocation.installments) {
        if (i.outstanding <= 0.001) continue;
        const isOverdue = i.due_date < today;
        const isThisWeek = !isOverdue && daysBetween(today, i.due_date) <= 7;
        if (!isOverdue && !isThisWeek) continue;
        rows.push({
          key: `${d.id}-${i.installment_id}`,
          deal: d,
          due_date: i.due_date,
          outstanding: i.outstanding,
          isOverdue,
        });
      }
    }
    rows.sort((a, b) => (a.due_date < b.due_date ? -1 : 1));
    return rows;
  }, [deals]);

  if (upcoming.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No installments due in the next 7 days. Nothing overdue.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      {upcoming.map((u) => (
        <div
          key={u.key}
          className={`flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm ${
            u.isOverdue
              ? "border-destructive/40 bg-destructive/5"
              : "border-amber-500/40 bg-amber-500/5"
          }`}
        >
          <div className="min-w-0">
            <p className="font-medium truncate">{u.deal.label}</p>
            <p className="text-xs text-muted-foreground truncate">
              {u.deal.contact?.company_name ?? "—"} · due{" "}
              {formatDateOnly(u.due_date)}
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="tabular-nums font-medium">
              {formatCurrency(u.outstanding, u.deal.currency)}
            </span>
            <Button size="sm" variant="outline" onClick={() => onPay(u.deal.id)}>
              Record
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

function daysBetween(fromIso: string, toIso: string): number {
  const a = Date.parse(fromIso);
  const b = Date.parse(toIso);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.floor((b - a) / 86_400_000);
}

export function RealEstateIndex() {
  const { data, isLoading, isError, error, refetch } = useDealStates();
  const [dealDialogOpen, setDealDialogOpen] = useState(false);
  const [editingDeal, setEditingDeal] = useState<DealState | null>(null);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receiptPrefill, setReceiptPrefill] = useState<ReceiptPrefill | null>(
    null,
  );

  const deals = data ?? [];

  const openNewDeal = () => {
    setEditingDeal(null);
    setDealDialogOpen(true);
  };
  const openEditDeal = (deal: DealState) => {
    setEditingDeal(deal);
    setDealDialogOpen(true);
  };
  const openReceipt = (prefill: ReceiptPrefill | null) => {
    setReceiptPrefill(prefill);
    setReceiptOpen(true);
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Real Estate</h1>
          <p className="text-sm text-muted-foreground">
            Rent and sale agreements with scheduled installments.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => openReceipt(null)}
            disabled={deals.length === 0}
          >
            <ReceiptText className="mr-2 size-4" />
            Record receipt
          </Button>
          <Button onClick={openNewDeal}>
            <Plus className="mr-2 size-4" />
            New deal
          </Button>
        </div>
      </header>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">Pending receipts</h2>
        {isLoading ? (
          <Skeleton className="h-12 w-full" />
        ) : isError ? (
          <div className="flex items-center justify-between gap-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm">
            <span className="text-destructive">
              Failed: {(error as Error).message}
            </span>
            <Button size="sm" variant="outline" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        ) : (
          <PendingReceiptsStrip
            deals={deals}
            onPay={(id) => openReceipt({ deal_id: id })}
          />
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">Active deals</h2>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : deals.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No deals yet. Click <strong>New deal</strong> to start.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {deals.map((d) => (
              <DealCard
                key={d.id}
                deal={d}
                onEdit={openEditDeal}
                onRecord={(deal) => openReceipt({ deal_id: deal.id })}
              />
            ))}
          </div>
        )}
      </section>

      <DealFormDialog
        open={dealDialogOpen}
        onOpenChange={setDealDialogOpen}
        deal={editingDeal}
      />
      <ReceiptFormDialog
        open={receiptOpen}
        onOpenChange={setReceiptOpen}
        deals={deals}
        prefill={receiptPrefill}
      />
    </div>
  );
}
