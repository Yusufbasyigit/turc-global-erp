"use client";

import { useMemo, useState } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { istanbulYearMonth } from "@/lib/proforma/istanbul-date";

import { ProfitLossMonthPicker } from "./profit-loss-month-picker";
import { ProfitLossSummary } from "./profit-loss-summary";
import { ProfitLossTable } from "./profit-loss-table";
import { ProfitLossTrend } from "./profit-loss-trend";
import { RateBanner } from "./rate-banner";
import { useMonthlyPandL } from "./queries";

export function ProfitLossIndex() {
  const anchor = useMemo(() => istanbulYearMonth(new Date()), []);
  const [period, setPeriod] = useState<string>(anchor);

  const data = useMonthlyPandL(period);
  const rateAvailable = data.rate.value != null;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Profit &amp; Loss
          </h1>
          <p className="text-sm text-muted-foreground">
            Monthly revenue, expense, and net result — TRY entries converted to
            USD at the month&apos;s rate.
          </p>
        </div>
        <ProfitLossMonthPicker
          value={period}
          onChange={setPeriod}
          anchor={anchor}
        />
      </header>

      {data.isLoading ? (
        <LoadingState />
      ) : data.isError ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          Failed to load profit &amp; loss data.
        </div>
      ) : (
        <>
          <RateBanner period={period} rate={data.rate} />
          <ProfitLossSummary
            totals={data.totals}
            rateAvailable={rateAvailable}
          />
          {data.totals.hasUnconverted ? (
            <p className="text-xs text-muted-foreground">
              Some entries are in a currency that isn&apos;t auto-converted —
              they appear in the table but don&apos;t contribute to the USD
              totals.
            </p>
          ) : null}
          <ProfitLossTable
            rows={data.rows}
            rateAvailable={rateAvailable}
          />
          <ProfitLossTrend period={period} onSelect={setPeriod} />
        </>
      )}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-12 w-full" />
      <div className="grid gap-3 sm:grid-cols-3">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
