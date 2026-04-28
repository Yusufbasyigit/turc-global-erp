"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Repeat } from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format-money";

import {
  listMonthlyOccurrences,
  listRecurringTemplates,
  pendingCountForMonth,
  recurringPaymentKeys,
  type MonthlyOccurrenceRow,
  type RecurringPaymentWithRelations,
} from "./queries";
import { setTemplateStatus, softDeleteTemplate } from "./mutations";
import { MarkPaidRow, PausedRow } from "./mark-paid-row";
import { RecurringPaymentFormDialog } from "./recurring-payment-form-dialog";
import { RecurringPaymentHistoryDrawer } from "./recurring-payment-history-drawer";

type Tab = "month" | "templates";

function getCurrentPeriod(): { year: number; month: number; day: number } {
  const d = new Date();
  return {
    year: d.getFullYear(),
    month: d.getMonth() + 1,
    day: d.getDate(),
  };
}

function monthLabel(year: number, month: number): string {
  return new Date(year, month - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

export function RecurringPaymentsButton() {
  const [open, setOpen] = useState(false);
  const { year, month } = getCurrentPeriod();

  const countQ = useQuery({
    queryKey: recurringPaymentKeys.pendingCount(year, month),
    queryFn: () => pendingCountForMonth(year, month),
  });
  const count = countQ.data ?? 0;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline">
          <Repeat className="mr-2 size-4" />
          Recurring
          {count > 0 ? (
            <Badge
              variant="destructive"
              className="ml-2 h-5 min-w-5 rounded-full px-1.5 text-[10px]"
            >
              {count}
            </Badge>
          ) : null}
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 data-[side=right]:sm:max-w-xl"
      >
        <RecurringPaymentsPanel />
      </SheetContent>
    </Sheet>
  );
}

function RecurringPaymentsPanel() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("month");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] =
    useState<RecurringPaymentWithRelations | null>(null);
  const [historyTarget, setHistoryTarget] =
    useState<RecurringPaymentWithRelations | null>(null);

  const { year, month, day } = useMemo(() => getCurrentPeriod(), []);

  const monthlyQ = useQuery({
    queryKey: recurringPaymentKeys.monthly(year, month),
    queryFn: () => listMonthlyOccurrences(year, month),
  });

  const templatesQ = useQuery({
    queryKey: recurringPaymentKeys.templates(),
    queryFn: listRecurringTemplates,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: recurringPaymentKeys.all });
  };

  const resumeMut = useMutation({
    mutationFn: (id: string) => setTemplateStatus(id, "active"),
    onSuccess: () => {
      invalidate();
      toast.success("Resumed");
    },
    onError: (e: Error) => toast.error(e.message ?? "Failed"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => softDeleteTemplate(id),
    onSuccess: () => {
      invalidate();
      toast.success("Deleted");
    },
    onError: (e: Error) => toast.error(e.message ?? "Failed"),
  });

  const monthly: MonthlyOccurrenceRow[] = useMemo(
    () => monthlyQ.data ?? [],
    [monthlyQ.data],
  );
  const templates: RecurringPaymentWithRelations[] = templatesQ.data ?? [];

  const pendingCount = monthly.filter((r) => r.occurrence === null).length;
  const paidCount = monthly.filter(
    (r) => r.occurrence?.status === "paid",
  ).length;
  const skippedCount = monthly.filter(
    (r) => r.occurrence?.status === "skipped",
  ).length;

  const sortedMonthly = useMemo(() => {
    // Pending (overdue first, then by day) → paid → skipped
    const pending: MonthlyOccurrenceRow[] = [];
    const paid: MonthlyOccurrenceRow[] = [];
    const skipped: MonthlyOccurrenceRow[] = [];
    for (const r of monthly) {
      if (!r.occurrence) pending.push(r);
      else if (r.occurrence.status === "paid") paid.push(r);
      else skipped.push(r);
    }
    pending.sort(
      (a, b) => a.template.day_of_month - b.template.day_of_month,
    );
    paid.sort(
      (a, b) =>
        (b.occurrence?.paid_date ?? "").localeCompare(
          a.occurrence?.paid_date ?? "",
        ),
    );
    return [...pending, ...paid, ...skipped];
  }, [monthly]);

  const activeTemplates = templates.filter((t) => t.status === "active");
  const pausedTemplates = templates.filter((t) => t.status === "paused");

  const openNew = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (t: RecurringPaymentWithRelations) => {
    setEditing(t);
    setFormOpen(true);
  };

  return (
    <>
      <SheetHeader className="border-b">
        <div className="flex items-start justify-between gap-3">
          <div>
            <SheetTitle>Recurring payments</SheetTitle>
            <SheetDescription>
              {monthLabel(year, month)} ·{" "}
              <span className="text-foreground">{pendingCount} pending</span>
              {paidCount > 0 ? <> · {paidCount} paid</> : null}
              {skippedCount > 0 ? <> · {skippedCount} skipped</> : null}
            </SheetDescription>
          </div>
          <Button size="sm" onClick={openNew}>
            <Plus className="mr-1 size-3.5" /> New
          </Button>
        </div>

        <div className="mt-3 flex gap-1 text-xs">
          <TabButton active={tab === "month"} onClick={() => setTab("month")}>
            This month
          </TabButton>
          <TabButton
            active={tab === "templates"}
            onClick={() => setTab("templates")}
          >
            Templates ({templates.length})
          </TabButton>
        </div>
      </SheetHeader>

      <div className="flex-1 overflow-y-auto p-4">
        {tab === "month" ? (
          <MonthView
            isLoading={monthlyQ.isLoading}
            rows={sortedMonthly}
            year={year}
            month={month}
            todayDay={day}
            onCreate={openNew}
            onOpenHistory={(tpl) => setHistoryTarget(tpl)}
            onEditTemplate={(tpl) => openEdit(tpl)}
          />
        ) : (
          <TemplatesView
            isLoading={templatesQ.isLoading}
            active={activeTemplates}
            paused={pausedTemplates}
            onCreate={openNew}
            onEdit={openEdit}
            onResume={(id) => resumeMut.mutate(id)}
            onDelete={(id) => deleteMut.mutate(id)}
            onOpenHistory={(tpl) => setHistoryTarget(tpl)}
          />
        )}
      </div>

      <RecurringPaymentFormDialog
        open={formOpen}
        onOpenChange={(o) => {
          setFormOpen(o);
          if (!o) setEditing(null);
        }}
        template={editing}
      />

      <RecurringPaymentHistoryDrawer
        open={Boolean(historyTarget)}
        onOpenChange={(o) => {
          if (!o) setHistoryTarget(null);
        }}
        template={historyTarget}
      />
    </>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-md px-3 py-1.5",
        active
          ? "bg-primary text-primary-foreground"
          : "bg-muted text-muted-foreground hover:bg-muted/80",
      )}
    >
      {children}
    </button>
  );
}

function MonthView({
  isLoading,
  rows,
  year,
  month,
  todayDay,
  onCreate,
  onOpenHistory,
  onEditTemplate,
}: {
  isLoading: boolean;
  rows: MonthlyOccurrenceRow[];
  year: number;
  month: number;
  todayDay: number;
  onCreate: () => void;
  onOpenHistory: (tpl: RecurringPaymentWithRelations) => void;
  onEditTemplate: (tpl: RecurringPaymentWithRelations) => void;
}) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center">
        <p className="mb-3 text-sm text-muted-foreground">
          No active recurring payments yet.
        </p>
        <Button onClick={onCreate}>
          <Plus className="mr-1 size-4" /> Add your first
        </Button>
      </div>
    );
  }
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.template.id}>
          <MarkPaidRow
            row={r}
            year={year}
            month={month}
            todayDay={todayDay}
            onOpenHistory={() => onOpenHistory(r.template)}
            onEditTemplate={() => onEditTemplate(r.template)}
          />
        </li>
      ))}
    </ul>
  );
}

function TemplatesView({
  isLoading,
  active,
  paused,
  onCreate,
  onEdit,
  onResume,
  onDelete,
  onOpenHistory,
}: {
  isLoading: boolean;
  active: RecurringPaymentWithRelations[];
  paused: RecurringPaymentWithRelations[];
  onCreate: () => void;
  onEdit: (tpl: RecurringPaymentWithRelations) => void;
  onResume: (id: string) => void;
  onDelete: (id: string) => void;
  onOpenHistory: (tpl: RecurringPaymentWithRelations) => void;
}) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }
  if (active.length === 0 && paused.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center">
        <p className="mb-3 text-sm text-muted-foreground">
          No templates yet.
        </p>
        <Button onClick={onCreate}>
          <Plus className="mr-1 size-4" /> Add your first
        </Button>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {active.length > 0 ? (
        <section className="space-y-2">
          <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Active ({active.length})
          </h3>
          <ul className="space-y-2">
            {active.map((t) => (
              <li
                key={t.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-card p-3 text-sm"
              >
                <div>
                  <button
                    type="button"
                    onClick={() => onOpenHistory(t)}
                    className="font-medium hover:underline"
                  >
                    {t.name}
                  </button>
                  <span className="ml-2 text-xs text-muted-foreground">
                    Day {t.day_of_month} ·{" "}
                    {formatCurrency(
                      Number(t.expected_amount),
                      t.currency,
                    )}{" "}
                    · {t.account?.account_name ?? "—"}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => onEdit(t)}
                  >
                    Edit
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {paused.length > 0 ? (
        <section className="space-y-2">
          <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Paused ({paused.length})
          </h3>
          <ul className="space-y-2">
            {paused.map((t) => (
              <li key={t.id}>
                <PausedRow
                  template={t}
                  onResume={() => onResume(t.id)}
                  onEdit={() => onEdit(t)}
                  onOpenHistory={() => onOpenHistory(t)}
                  onDelete={() => onDelete(t.id)}
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
