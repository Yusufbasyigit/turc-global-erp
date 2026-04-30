"use client";

import { useMemo } from "react";
import { AlertTriangle } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatUsd } from "@/features/treasury/fx-utils";

import {
  addTotals,
  emptyTotals,
  usePeriodTotals,
  type Totals,
  type TrendBucket,
} from "./queries";
import {
  quartersOfYear,
  trailingYears,
  type PeriodBucket,
} from "./period-helpers";
import { ProfitLossTrendMulti } from "./profit-loss-trend-multi";

type Kind = "quarter" | "year";

type ColumnAggregate = {
  bucket: PeriodBucket;
  totals: Totals;
  missingRateMonthCount: number;
};

export function ProfitLossMultiPeriodView({
  kind,
  year,
}: {
  kind: Kind;
  year?: number;
}) {
  const buckets = useMemo<PeriodBucket[]>(() => {
    if (kind === "quarter") {
      return quartersOfYear(year ?? new Date().getFullYear());
    }
    return trailingYears(5);
  }, [kind, year]);

  const allMonths = useMemo(() => {
    const seen = new Set<string>();
    for (const b of buckets) for (const m of b.months) seen.add(m);
    return Array.from(seen);
  }, [buckets]);

  const { totalsByMonth, missingRateMonths, isLoading, isError } =
    usePeriodTotals(allMonths);

  const columns = useMemo<ColumnAggregate[]>(() => {
    return buckets.map((b) => {
      let totals = emptyTotals();
      let missingRateMonthCount = 0;
      for (const m of b.months) {
        const t = totalsByMonth.get(m);
        if (!t) continue;
        totals = addTotals(totals, t);
        if (missingRateMonths.has(m)) missingRateMonthCount += 1;
      }
      return { bucket: b, totals, missingRateMonthCount };
    });
  }, [buckets, totalsByMonth, missingRateMonths]);

  const trendBuckets: TrendBucket[] = useMemo(
    () =>
      buckets.map((b) => ({
        key: b.key,
        label: b.label,
        months: b.months,
      })),
    [buckets],
  );

  const inProgressKey = useMemo(
    () => buckets.find((b) => b.isInProgress)?.key,
    [buckets],
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
        Failed to load profit &amp; loss data.
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={150}>
      <div className="overflow-hidden rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px]"> </TableHead>
              {columns.map((c) => (
                <TableHead
                  key={c.bucket.key}
                  className="text-right text-sm tabular-nums"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span className="font-medium text-foreground">
                      {c.bucket.label}
                    </span>
                    {c.bucket.isInProgress ? (
                      <span className="text-[11px] font-normal italic text-muted-foreground">
                        (in progress)
                      </span>
                    ) : null}
                    {c.missingRateMonthCount > 0 ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="cursor-help text-amber-600">
                            <AlertTriangle className="h-3.5 w-3.5" />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          {c.missingRateMonthCount === 1
                            ? "1 month is missing a TRY rate; its TRY entries are excluded from this column's USD total."
                            : `${c.missingRateMonthCount} months are missing a TRY rate; their TRY entries are excluded from this column's USD total.`}
                        </TooltipContent>
                      </Tooltip>
                    ) : null}
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            <RevenueLineRow
              label="Revenue — Export"
              columns={columns}
              valueOf={(t) => t.revenueExportUsd}
              tone="positive"
            />
            <RevenueLineRow
              label="Revenue — Real Estate"
              columns={columns}
              valueOf={(t) => t.revenueRealEstateUsd}
              tone="positive"
            />
            <TotalRow
              label="Total Revenue"
              columns={columns}
              valueOf={(t) => t.revenueUsd}
              tone="positive"
            />
            <TotalRow
              label="Total Expense"
              columns={columns}
              valueOf={(t) => t.expenseUsd}
              tone="negative"
            />
            <TotalRow
              label="Net P&L"
              columns={columns}
              valueOf={(t) => t.netUsd}
              tone="net"
              emphasized
            />
          </TableBody>
        </Table>
      </div>

      <ProfitLossTrendMulti
        title={
          kind === "quarter"
            ? "Net P&L · by quarter"
            : "Net P&L · trailing 5 years"
        }
        buckets={trendBuckets}
        inProgressKey={inProgressKey}
      />
    </TooltipProvider>
  );
}

function RevenueLineRow({
  label,
  columns,
  valueOf,
  tone,
}: {
  label: string;
  columns: ColumnAggregate[];
  valueOf: (t: Totals) => number;
  tone: "positive" | "negative" | "net";
}) {
  return (
    <TableRow>
      <TableCell className="text-sm text-muted-foreground">{label}</TableCell>
      {columns.map((c) => (
        <TableCell
          key={c.bucket.key}
          className="text-right text-sm tabular-nums"
        >
          <CellValue value={valueOf(c.totals)} tone={tone} />
        </TableCell>
      ))}
    </TableRow>
  );
}

function TotalRow({
  label,
  columns,
  valueOf,
  tone,
  emphasized,
}: {
  label: string;
  columns: ColumnAggregate[];
  valueOf: (t: Totals) => number;
  tone: "positive" | "negative" | "net";
  emphasized?: boolean;
}) {
  return (
    <TableRow className={emphasized ? "border-t-2 bg-muted/40" : "border-t"}>
      <TableCell
        className={cn(
          "text-sm",
          emphasized ? "font-semibold" : "font-medium",
        )}
      >
        {label}
      </TableCell>
      {columns.map((c) => (
        <TableCell
          key={c.bucket.key}
          className={cn(
            "text-right tabular-nums",
            emphasized ? "text-base font-semibold" : "text-sm font-medium",
          )}
        >
          <CellValue value={valueOf(c.totals)} tone={tone} />
        </TableCell>
      ))}
    </TableRow>
  );
}

function CellValue({
  value,
  tone,
}: {
  value: number;
  tone: "positive" | "negative" | "net";
}) {
  const toneClass =
    tone === "positive"
      ? "text-emerald-700"
      : tone === "negative"
        ? "text-rose-700"
        : value > 0
          ? "text-emerald-700"
          : value < 0
            ? "text-rose-700"
            : "text-foreground";

  if (value === 0) {
    return <span className="text-muted-foreground">—</span>;
  }
  return <span className={toneClass}>{formatUsd(value)}</span>;
}
