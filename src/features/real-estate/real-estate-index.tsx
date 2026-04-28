"use client";

import { useMemo, useState } from "react";
import { Plus, ReceiptText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/format-money";
import { formatDateOnly } from "@/lib/format-date";
import { todayDateString } from "@/features/treasury/fx-utils";
import { daysBetween, useDealStates, type DealState } from "./queries";
import { DealFormDialog } from "./deal-form-dialog";
import {
  ReceiptFormDialog,
  type ReceiptPrefill,
} from "./receipt-form-dialog";
import { DealCard } from "./deal-card";

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
