"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Slash, Undo2 } from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format-money";
import { formatDateOnly } from "@/lib/format-date";

import {
  listTemplateHistory,
  recurringPaymentKeys,
  type RecurringPaymentWithRelations,
} from "./queries";
import { undoOccurrence } from "./mutations";

export function RecurringPaymentHistoryDrawer({
  open,
  onOpenChange,
  template,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: RecurringPaymentWithRelations | null;
}) {
  const qc = useQueryClient();

  const historyQ = useQuery({
    queryKey: template
      ? recurringPaymentKeys.history(template.id)
      : ["history-disabled"],
    queryFn: () => listTemplateHistory(template!.id),
    enabled: open && Boolean(template),
  });

  const undoMut = useMutation({
    mutationFn: undoOccurrence,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: recurringPaymentKeys.all });
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["treasury"] });
      toast.success("Reverted");
    },
    onError: (e: Error) => toast.error(e.message ?? "Failed to undo"),
  });

  const rows = historyQ.data ?? [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 data-[side=right]:sm:max-w-md"
      >
        <SheetHeader className="border-b">
          <SheetTitle>{template?.name ?? "Payment history"}</SheetTitle>
          <SheetDescription>
            Every month this recurring payment was paid or skipped.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-4">
          {historyQ.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No history yet. Pay or skip a month to see it here.
            </p>
          ) : (
            <ul className="space-y-2">
              {rows.map((r) => {
                const isPaid = r.status === "paid";
                return (
                  <li
                    key={r.id}
                    className={cn(
                      "flex items-start justify-between gap-3 rounded-md border p-3 text-sm",
                      isPaid
                        ? "border-emerald-500/30 bg-emerald-500/5"
                        : "border-muted bg-muted/30",
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] uppercase",
                            isPaid
                              ? "border-emerald-600 text-emerald-700"
                              : "border-muted-foreground text-muted-foreground",
                          )}
                        >
                          {isPaid ? (
                            <>
                              <Check className="mr-1 size-3" /> Paid
                            </>
                          ) : (
                            <>
                              <Slash className="mr-1 size-3" /> Skipped
                            </>
                          )}
                        </Badge>
                        <span className="font-medium">
                          {monthLabel(r.period_year, r.period_month)}
                        </span>
                      </div>
                      {isPaid && r.paid_amount && template ? (
                        <div className="mt-1 text-xs text-muted-foreground">
                          {formatCurrency(
                            Number(r.paid_amount),
                            template.currency,
                          )}
                          {r.paid_date ? (
                            <> · paid {formatDateOnly(r.paid_date)}</>
                          ) : null}
                        </div>
                      ) : null}
                      {r.transaction ? (
                        <Link
                          href={`/transactions?action=edit&id=${r.transaction.id}`}
                          className="mt-1 inline-block text-xs text-primary hover:underline"
                        >
                          View transaction →
                        </Link>
                      ) : null}
                      {r.notes ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {r.notes}
                        </p>
                      ) : null}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={undoMut.isPending}
                      onClick={() => undoMut.mutate(r.id)}
                      title={
                        isPaid
                          ? "Undo: deletes the linked transaction and re-opens the month."
                          : "Un-skip this month."
                      }
                    >
                      <Undo2 className="mr-1 size-3.5" />
                      Undo
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function monthLabel(year: number, month: number): string {
  const d = new Date(year, month - 1, 1);
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}
