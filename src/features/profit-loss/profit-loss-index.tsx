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
import {
  ProfitLossFrequencyToggle,
  type Frequency,
} from "./profit-loss-frequency-toggle";
import { ProfitLossYearPicker } from "./profit-loss-year-picker";
import { ProfitLossMultiPeriodView } from "./profit-loss-multi-period-view";
import { currentYear } from "./period-helpers";

export function ProfitLossIndex() {
  const anchor = useMemo(() => istanbulYearMonth(new Date()), []);
  const [period, setPeriod] = useState<string>(anchor);
  const [frequency, setFrequency] = useState<Frequency>("month");
  const [year, setYear] = useState<number>(() => currentYear());

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Profit &amp; Loss
          </h1>
          <p className="text-sm text-muted-foreground">
            {frequency === "month"
              ? "Monthly revenue, expense, and net result — TRY entries converted to USD at the month's rate."
              : frequency === "quarter"
                ? "Quarterly totals — each column sums its three monthly USD values."
                : "Annual totals — each column sums its twelve monthly USD values."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <ProfitLossFrequencyToggle value={frequency} onChange={setFrequency} />
          {frequency === "month" ? (
            <ProfitLossMonthPicker
              value={period}
              onChange={setPeriod}
              anchor={anchor}
            />
          ) : null}
          {frequency === "quarter" ? (
            <ProfitLossYearPicker value={year} onChange={setYear} />
          ) : null}
        </div>
      </header>

      {frequency === "month" ? (
        <MonthlyView period={period} setPeriod={setPeriod} />
      ) : frequency === "quarter" ? (
        <ProfitLossMultiPeriodView kind="quarter" year={year} />
      ) : (
        <ProfitLossMultiPeriodView kind="year" />
      )}
    </div>
  );
}

function MonthlyView({
  period,
  setPeriod,
}: {
  period: string;
  setPeriod: (p: string) => void;
}) {
  const data = useMonthlyPandL(period);
  const rateAvailable = data.rate.value != null;

  if (data.isLoading) return <LoadingState />;
  if (data.isError) {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
        Failed to load profit &amp; loss data.
      </div>
    );
  }

  return (
    <>
      <RateBanner period={period} rate={data.rate} />
      <ProfitLossSummary totals={data.totals} rateAvailable={rateAvailable} />
      {data.totals.hasUnconverted ? (
        <p className="text-xs text-muted-foreground">
          Some entries are in a currency that isn&apos;t auto-converted — they
          appear in the table but don&apos;t contribute to the USD totals.
        </p>
      ) : null}
      <ProfitLossTable rows={data.rows} rateAvailable={rateAvailable} />
      <ProfitLossTrend period={period} onSelect={setPeriod} />
    </>
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
