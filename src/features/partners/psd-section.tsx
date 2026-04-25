"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency as formatMoney } from "@/lib/format-money";
import { usePsdSummary } from "./queries/psd-summary";
import { PsdCalendarDrawer } from "./psd-calendar-drawer";

export function PsdSection() {
  const router = useRouter();
  const [calendarOpen, setCalendarOpen] = useState(false);
  const currentYear = new Date().getFullYear();

  const { data, isLoading, isError, error } = usePsdSummary({
    yearFrom: currentYear,
    yearTo: currentYear,
  });

  const totalsByCurrency = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of data ?? []) {
      m.set(r.currency, (m.get(r.currency) ?? 0) + r.amount);
    }
    return Array.from(m.entries())
      .map(([currency, amount]) => ({ currency, amount }))
      .sort((a, b) => a.currency.localeCompare(b.currency));
  }, [data]);

  const logPsd = () => {
    const params = new URLSearchParams({
      action: "new",
      kind: "profit_distribution",
    });
    router.push(`/transactions?${params.toString()}`);
  };

  return (
    <section className="flex flex-col gap-2 border-y border-border py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 min-w-0">
        <span className="text-sm font-medium">PSD {currentYear}</span>
        {isLoading ? (
          <Skeleton className="h-5 w-40" />
        ) : isError ? (
          <span className="text-sm text-destructive">
            Failed to load: {(error as Error).message}
          </span>
        ) : totalsByCurrency.length === 0 ? (
          <span className="text-sm text-muted-foreground">
            No distributions yet
          </span>
        ) : (
          totalsByCurrency.map((t) => (
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
          onClick={() => setCalendarOpen(true)}
        >
          <CalendarDays className="mr-2 size-4" />
          Calendar
        </Button>
        <Button size="sm" onClick={logPsd}>
          <Plus className="mr-2 size-4" />
          Log PSD
        </Button>
      </div>

      <PsdCalendarDrawer
        open={calendarOpen}
        onOpenChange={setCalendarOpen}
        currentYear={currentYear}
      />
    </section>
  );
}
