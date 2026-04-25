"use client";

import { useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatCurrency as formatMoney } from "@/lib/format-money";
import { usePsdSummary, type PsdRow } from "./queries/psd-summary";

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

export function PsdCalendarDrawer({
  open,
  onOpenChange,
  currentYear,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  currentYear: number;
}) {
  const yearFrom = currentYear - 2;
  const yearTo = currentYear;

  const { data, isLoading, isError, error } = usePsdSummary({
    yearFrom,
    yearTo,
  });

  const years = useMemo(() => {
    const arr: number[] = [];
    for (let y = yearFrom; y <= yearTo; y++) arr.push(y);
    return arr;
  }, [yearFrom, yearTo]);

  const byCell = useMemo(() => {
    const map = new Map<CellKey, PsdRow[]>();
    for (const r of data ?? []) {
      const key: CellKey = `${r.year}-${r.month}`;
      const list = map.get(key) ?? [];
      list.push(r);
      map.set(key, list);
    }
    return map;
  }, [data]);

  const yearTotals = useMemo(() => {
    const byYear = new Map<number, Map<string, number>>();
    for (const r of data ?? []) {
      let inner = byYear.get(r.year);
      if (!inner) {
        inner = new Map();
        byYear.set(r.year, inner);
      }
      inner.set(r.currency, (inner.get(r.currency) ?? 0) + r.amount);
    }
    return byYear;
  }, [data]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full gap-0 overflow-y-auto sm:max-w-2xl"
      >
        <SheetHeader className="border-b">
          <SheetTitle>Profit share calendar</SheetTitle>
          <SheetDescription>
            Combined monthly totals across all partners, per currency.
          </SheetDescription>
        </SheetHeader>

        <div className="p-4">
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : isError ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
              Failed to load: {(error as Error).message}
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
                          const rows = byCell.get(`${y}-${month}`) ?? [];
                          return (
                            <td
                              key={y}
                              className="px-3 py-2 text-right tabular-nums"
                            >
                              {rows.length === 0 ? (
                                <span className="text-muted-foreground">
                                  —
                                </span>
                              ) : (
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
                              )}
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
