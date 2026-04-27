"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/format-money";
import { formatDateOnly } from "@/lib/format-date";
import { todayDateString } from "@/features/treasury/fx-utils";
import { InstallmentRow } from "./installment-row";
import type { DealState } from "./queries";

export function dealStatus(deal: DealState): {
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

export function DealCard({
  deal,
  onEdit,
  onRecord,
  showContactName = true,
}: {
  deal: DealState;
  onEdit: (deal: DealState) => void;
  onRecord: (deal: DealState) => void;
  showContactName?: boolean;
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
              {showContactName ? `${deal.contact?.company_name ?? "—"} · ` : ""}
              started {formatDateOnly(deal.start_date)}
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
