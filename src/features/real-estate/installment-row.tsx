"use client";

import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/format-money";
import { formatDateOnly } from "@/lib/format-date";
import type { InstallmentState } from "@/lib/ledger/installment-allocation";

const STATUS_LABEL: Record<InstallmentState["status"], string> = {
  paid: "Paid",
  partial: "Partial",
  due: "Due",
  overdue: "Overdue",
};

const STATUS_CLASS: Record<InstallmentState["status"], string> = {
  paid: "bg-emerald-100 text-emerald-900 border-emerald-200",
  partial: "bg-amber-100 text-amber-900 border-amber-200",
  due: "bg-muted text-foreground/80",
  overdue: "bg-destructive/10 text-destructive border-destructive/30",
};

export function InstallmentRow({
  state,
  currency,
}: {
  state: InstallmentState;
  currency: string;
}) {
  return (
    <div className="grid grid-cols-[80px_1fr_120px_120px_90px] items-center gap-3 border-b border-border/60 px-2 py-1.5 text-sm last:border-0">
      <span className="text-muted-foreground tabular-nums">
        #{state.sequence}
      </span>
      <span className="tabular-nums">{formatDateOnly(state.due_date)}</span>
      <span className="text-right tabular-nums text-muted-foreground">
        {formatCurrency(state.expected_amount, currency)}
      </span>
      <span className="text-right tabular-nums">
        {state.outstanding > 0.001
          ? formatCurrency(state.outstanding, currency)
          : "—"}
      </span>
      <span className="justify-self-end">
        <Badge variant="outline" className={STATUS_CLASS[state.status]}>
          {STATUS_LABEL[state.status]}
        </Badge>
      </span>
    </div>
  );
}
