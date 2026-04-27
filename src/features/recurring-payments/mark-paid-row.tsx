"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertCircle,
  Check,
  ChevronUp,
  History,
  MoreHorizontal,
  Pause,
  Pencil,
  Slash,
  Undo2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format-money";

import {
  type MonthlyOccurrenceRow,
  effectiveDayForMonth,
  recurringPaymentKeys,
} from "./queries";
import {
  markOccurrencePaid,
  setTemplateStatus,
  skipOccurrence,
  undoOccurrence,
} from "./mutations";

function todayLocalIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function MarkPaidRow({
  row,
  year,
  month,
  todayDay,
  onOpenHistory,
  onEditTemplate,
}: {
  row: MonthlyOccurrenceRow;
  year: number;
  month: number;
  todayDay: number;
  onOpenHistory: () => void;
  onEditTemplate: () => void;
}) {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [actualAmount, setActualAmount] = useState<string>(
    String(Number(row.template.expected_amount)),
  );
  const [paidDate, setPaidDate] = useState<string>(todayLocalIso());

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: recurringPaymentKeys.all });
    qc.invalidateQueries({ queryKey: ["transactions"] });
    qc.invalidateQueries({ queryKey: ["treasury"] });
  };

  const markPaidMut = useMutation({
    mutationFn: markOccurrencePaid,
    onSuccess: () => {
      invalidate();
      toast.success(`${row.template.name} marked paid`);
      setExpanded(false);
    },
    onError: (e: Error) => toast.error(e.message ?? "Failed to mark paid"),
  });

  const skipMut = useMutation({
    mutationFn: skipOccurrence,
    onSuccess: () => {
      invalidate();
      toast.success("Skipped");
      setExpanded(false);
    },
    onError: (e: Error) => toast.error(e.message ?? "Failed to skip"),
  });

  const undoMut = useMutation({
    mutationFn: undoOccurrence,
    onSuccess: () => {
      invalidate();
      toast.success("Reverted");
    },
    onError: (e: Error) => toast.error(e.message ?? "Failed to undo"),
  });

  const pauseMut = useMutation({
    mutationFn: () => setTemplateStatus(row.template.id, "paused"),
    onSuccess: () => {
      invalidate();
      toast.success(`${row.template.name} paused`);
    },
    onError: (e: Error) => toast.error(e.message ?? "Failed to pause"),
  });

  const status: "pending" | "paid" | "skipped" = row.occurrence
    ? (row.occurrence.status as "paid" | "skipped")
    : "pending";

  const effectiveDay = effectiveDayForMonth(
    row.template.day_of_month,
    year,
    month,
  );
  const isOverdue = status === "pending" && todayDay > effectiveDay;

  const handleMarkPaid = () => {
    const amt = Number(actualAmount);
    if (!Number.isFinite(amt) || amt <= 0) {
      toast.error("Amount must be greater than zero");
      return;
    }
    markPaidMut.mutate({
      templateId: row.template.id,
      year,
      month,
      paidAmount: amt,
      paidDate,
    });
  };

  const accountLabel = row.template.account?.account_name ?? "—";
  const isCardAccount = row.template.account?.asset_type === "credit_card";

  const expectedFormatted = formatCurrency(
    Number(row.template.expected_amount),
    row.template.currency,
  );

  return (
    <div
      className={cn(
        "rounded-md border bg-card p-3 text-sm",
        status === "paid" && "border-emerald-500/40 bg-emerald-500/5",
        status === "skipped" && "border-muted bg-muted/30 opacity-80",
        isOverdue && "border-destructive/50 bg-destructive/5",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <button
              type="button"
              onClick={onOpenHistory}
              className="break-words text-left font-medium hover:underline"
              title="Open payment history"
            >
              {row.template.name}
            </button>
            {status === "paid" ? (
              <Badge
                variant="outline"
                className="border-emerald-600 text-[10px] text-emerald-700"
              >
                <Check className="mr-1 size-3" /> Paid
              </Badge>
            ) : status === "skipped" ? (
              <Badge variant="outline" className="text-[10px]">
                <Slash className="mr-1 size-3" /> Skipped
              </Badge>
            ) : isOverdue ? (
              <Badge
                variant="outline"
                className="border-destructive text-[10px] text-destructive"
              >
                <AlertCircle className="mr-1 size-3" /> Overdue
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px]">
                Day {effectiveDay}
              </Badge>
            )}
            {isCardAccount ? (
              <Badge variant="outline" className="text-[10px]">
                Card
              </Badge>
            ) : null}
          </div>
          <div className="mt-1 break-words text-xs text-muted-foreground">
            {expectedFormatted} · {accountLabel}
            {row.template.contact?.company_name ? (
              <> · {row.template.contact.company_name}</>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {status === "pending" ? (
            <Button
              type="button"
              size="sm"
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? (
                <>
                  <ChevronUp className="mr-1 size-3.5" /> Cancel
                </>
              ) : (
                <>
                  <Check className="mr-1 size-3.5" /> Mark paid
                </>
              )}
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() =>
                row.occurrence ? undoMut.mutate(row.occurrence.id) : null
              }
              disabled={undoMut.isPending}
            >
              <Undo2 className="mr-1 size-3.5" /> Undo
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                aria-label="More actions"
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {status === "pending" ? (
                <>
                  <DropdownMenuItem
                    onSelect={() =>
                      skipMut.mutate({
                        templateId: row.template.id,
                        year,
                        month,
                      })
                    }
                  >
                    <Slash className="mr-2 size-4" />
                    Skip this month
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => pauseMut.mutate()}>
                    <Pause className="mr-2 size-4" />
                    Pause template
                  </DropdownMenuItem>
                </>
              ) : null}
              <DropdownMenuItem onSelect={onEditTemplate}>
                <Pencil className="mr-2 size-4" />
                Edit template
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onOpenHistory}>
                <History className="mr-2 size-4" />
                History
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {expanded && status === "pending" ? (
        <div className="mt-3 space-y-3 rounded-md bg-muted/40 p-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">
                Actual amount ({row.template.currency})
              </Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={actualAmount}
                onChange={(e) => setActualAmount(e.target.value)}
              />
              <p className="text-[10px] text-muted-foreground">
                Defaults to the expected {expectedFormatted}. Override if it
                changed this month (e.g. credit card statement).
              </p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">
                Paid on
              </Label>
              <Input
                type="date"
                value={paidDate}
                onChange={(e) => setPaidDate(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setExpanded(false)}
              disabled={markPaidMut.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleMarkPaid}
              disabled={markPaidMut.isPending}
            >
              <Check className="mr-1 size-3.5" />
              {markPaidMut.isPending ? "Saving…" : "Confirm & record"}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function PausedRow({
  template,
  onResume,
  onEdit,
  onOpenHistory,
  onDelete,
}: {
  template: import("./queries").RecurringPaymentWithRelations;
  onResume: () => void;
  onEdit: () => void;
  onOpenHistory: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/20 p-3 text-sm opacity-80">
      <div>
        <button
          type="button"
          onClick={onOpenHistory}
          className="font-medium hover:underline"
        >
          {template.name}
        </button>
        <span className="ml-2 text-xs text-muted-foreground">
          Day {template.day_of_month} ·{" "}
          {formatCurrency(
            Number(template.expected_amount),
            template.currency,
          )}
        </span>
        <Badge variant="secondary" className="ml-2 text-[10px]">
          Paused
        </Badge>
      </div>
      <div className="flex items-center gap-1">
        <Button type="button" size="sm" variant="outline" onClick={onResume}>
          Resume
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onEdit}>
          <Pencil className="size-3.5" />
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={onOpenHistory}
        >
          <History className="size-3.5" />
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={onDelete}
          className="text-destructive"
          title="Delete template"
        >
          ×
        </Button>
      </div>
    </div>
  );
}
