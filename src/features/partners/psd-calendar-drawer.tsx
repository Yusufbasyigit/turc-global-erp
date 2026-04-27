"use client";

import { useMemo } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatCurrency as formatMoney } from "@/lib/format-money";
import { istanbulYearMonth } from "@/lib/proforma/istanbul-date";
import {
  usePsdEvents,
  usePsdSummary,
  type PsdEventWithLegs,
  type PsdRow,
} from "./queries/psd-summary";

const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

type CellKey = `${number}-${number}`;

function eventYearMonth(eventDate: string): { year: number; month: number } {
  const ym = istanbulYearMonth(eventDate);
  const [y, m] = ym.split("-");
  return { year: Number(y), month: Number(m) };
}

export function PsdCalendarDrawer({
  open,
  onOpenChange,
  currentYear,
  onEditEvent,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  currentYear: number;
  onEditEvent: (event: PsdEventWithLegs) => void;
}) {
  const yearFrom = currentYear - 2;
  const yearTo = currentYear;

  const summaryQ = usePsdSummary({ yearFrom, yearTo });
  const eventsQ = usePsdEvents({ yearFrom, yearTo });

  const years = useMemo(() => {
    const arr: number[] = [];
    for (let y = yearFrom; y <= yearTo; y++) arr.push(y);
    return arr;
  }, [yearFrom, yearTo]);

  const byCell = useMemo(() => {
    const map = new Map<CellKey, PsdRow[]>();
    for (const r of summaryQ.data ?? []) {
      const key: CellKey = `${r.year}-${r.month}`;
      const list = map.get(key) ?? [];
      list.push(r);
      map.set(key, list);
    }
    return map;
  }, [summaryQ.data]);

  const eventsByCell = useMemo(() => {
    const map = new Map<CellKey, PsdEventWithLegs[]>();
    for (const e of eventsQ.data ?? []) {
      const { year, month } = eventYearMonth(e.event_date);
      const key: CellKey = `${year}-${month}`;
      const list = map.get(key) ?? [];
      list.push(e);
      map.set(key, list);
    }
    return map;
  }, [eventsQ.data]);

  const yearTotals = useMemo(() => {
    const byYear = new Map<number, Map<string, number>>();
    for (const r of summaryQ.data ?? []) {
      let inner = byYear.get(r.year);
      if (!inner) {
        inner = new Map();
        byYear.set(r.year, inner);
      }
      inner.set(r.currency, (inner.get(r.currency) ?? 0) + r.amount);
    }
    return byYear;
  }, [summaryQ.data]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full gap-0 overflow-y-auto sm:max-w-2xl"
      >
        <SheetHeader className="border-b">
          <SheetTitle>Profit share calendar</SheetTitle>
          <SheetDescription>
            Combined monthly totals across all owners, per currency. Click a
            cell to view and edit the events behind it.
          </SheetDescription>
        </SheetHeader>

        <div className="p-4">
          {summaryQ.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : summaryQ.isError ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
              Failed to load: {(summaryQ.error as Error).message}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="min-w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Month</th>
                    {years.map((y) => (
                      <th
                        key={y}
                        className="px-3 py-2 text-right font-medium tabular-nums"
                      >
                        {y}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {MONTH_NAMES.map((monthName, idx) => {
                    const month = idx + 1;
                    return (
                      <tr key={month}>
                        <td className="px-3 py-2 text-muted-foreground">
                          {monthName}
                        </td>
                        {years.map((y) => {
                          const cellKey: CellKey = `${y}-${month}`;
                          const rows = byCell.get(cellKey) ?? [];
                          const events = eventsByCell.get(cellKey) ?? [];
                          if (rows.length === 0) {
                            return (
                              <td
                                key={y}
                                className="px-3 py-2 text-right tabular-nums"
                              >
                                <span className="text-muted-foreground">—</span>
                              </td>
                            );
                          }
                          return (
                            <td
                              key={y}
                              className="px-1 py-1 text-right tabular-nums"
                            >
                              <Popover>
                                <PopoverTrigger asChild>
                                  <button
                                    type="button"
                                    className="w-full rounded px-2 py-1 text-right hover:bg-accent"
                                  >
                                    <div className="flex flex-col gap-0.5">
                                      {rows
                                        .slice()
                                        .sort((a, b) =>
                                          a.currency.localeCompare(b.currency),
                                        )
                                        .map((r) => (
                                          <span key={r.currency}>
                                            {formatMoney(r.amount, r.currency)}
                                          </span>
                                        ))}
                                    </div>
                                  </button>
                                </PopoverTrigger>
                                <PopoverContent
                                  align="end"
                                  className="w-80 p-0"
                                >
                                  <div className="border-b px-3 py-2 text-xs font-medium text-muted-foreground">
                                    {monthName} {y} ·{" "}
                                    {events.length} event
                                    {events.length === 1 ? "" : "s"}
                                  </div>
                                  <div className="max-h-72 divide-y overflow-y-auto">
                                    {events.length === 0 ? (
                                      <div className="px-3 py-3 text-xs text-muted-foreground">
                                        Loading events…
                                      </div>
                                    ) : (
                                      events.map((event) => {
                                        const legTotals = new Map<
                                          string,
                                          number
                                        >();
                                        for (const leg of event.legs) {
                                          const amt = Number(leg.amount);
                                          if (!Number.isFinite(amt)) continue;
                                          legTotals.set(
                                            leg.currency,
                                            (legTotals.get(leg.currency) ?? 0) +
                                              amt,
                                          );
                                        }
                                        const sorted = Array.from(
                                          legTotals.entries(),
                                        ).sort(([a], [b]) =>
                                          a.localeCompare(b),
                                        );
                                        return (
                                          <div
                                            key={event.id}
                                            className="flex items-start gap-2 px-3 py-2"
                                          >
                                            <div className="flex-1 min-w-0">
                                              <div className="text-xs font-medium">
                                                {event.event_date}
                                                {event.fiscal_period
                                                  ? ` · ${event.fiscal_period}`
                                                  : ""}
                                              </div>
                                              <div className="mt-0.5 flex flex-wrap gap-x-2 text-xs tabular-nums">
                                                {sorted.map(([ccy, amt]) => (
                                                  <span key={ccy}>
                                                    {formatMoney(amt, ccy)}
                                                  </span>
                                                ))}
                                              </div>
                                              {event.note ? (
                                                <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
                                                  {event.note}
                                                </div>
                                              ) : null}
                                            </div>
                                            <Button
                                              size="icon"
                                              variant="ghost"
                                              className="size-7"
                                              onClick={() =>
                                                onEditEvent(event)
                                              }
                                              aria-label="Edit event"
                                            >
                                              <Pencil className="size-3.5" />
                                            </Button>
                                          </div>
                                        );
                                      })
                                    )}
                                  </div>
                                </PopoverContent>
                              </Popover>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="border-t bg-muted/20 text-xs">
                  <tr>
                    <td className="px-3 py-2 font-medium text-muted-foreground">
                      Year total
                    </td>
                    {years.map((y) => {
                      const inner = yearTotals.get(y);
                      const currencies = inner
                        ? Array.from(inner.entries()).sort(([a], [b]) =>
                            a.localeCompare(b),
                          )
                        : [];
                      return (
                        <td
                          key={y}
                          className="px-3 py-2 text-right tabular-nums"
                        >
                          {currencies.length === 0 ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            <div className="flex flex-col gap-0.5 font-medium">
                              {currencies.map(([currency, amount]) => (
                                <span key={currency}>
                                  {formatMoney(amount, currency)}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
