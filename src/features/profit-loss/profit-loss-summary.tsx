"use client";

import { ArrowDown, ArrowUp, Equal } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatUsd } from "@/features/treasury/fx-utils";
import { formatTryFull } from "@/features/dashboard/editorial-format";

import type { Totals } from "./queries";

export function ProfitLossSummary({
  totals,
  rateAvailable,
}: {
  totals: Totals;
  rateAvailable: boolean;
}) {
  return (
    <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
      <SummaryCard
        title="Revenue"
        usd={totals.revenueUsd}
        try_={totals.revenueTry}
        rateAvailable={rateAvailable}
        tone="positive"
        icon={<ArrowUp className="h-3.5 w-3.5" />}
        breakdown={
          totals.revenueRealEstateUsd > 0 || totals.revenueExportUsd > 0
            ? [
                {
                  label: "Export",
                  usd: totals.revenueExportUsd,
                },
                {
                  label: "Real estate",
                  usd: totals.revenueRealEstateUsd,
                },
              ]
            : undefined
        }
      />
      <SummaryCard
        title="Expense"
        usd={totals.expenseUsd}
        try_={totals.expenseTry}
        rateAvailable={rateAvailable}
        tone="negative"
        icon={<ArrowDown className="h-3.5 w-3.5" />}
      />
      <SummaryCard
        title="Net P&L"
        usd={totals.netUsd}
        try_={totals.netTry}
        rateAvailable={rateAvailable}
        tone={totals.netUsd > 0 ? "positive" : totals.netUsd < 0 ? "negative" : "neutral"}
        icon={<Equal className="h-3.5 w-3.5" />}
        emphasized
      />
    </div>
  );
}

function SummaryCard({
  title,
  usd,
  try_,
  rateAvailable,
  tone,
  icon,
  emphasized,
  breakdown,
}: {
  title: string;
  usd: number;
  try_: number;
  rateAvailable: boolean;
  tone: "positive" | "negative" | "neutral";
  icon: React.ReactNode;
  emphasized?: boolean;
  breakdown?: { label: string; usd: number }[];
}) {
  const toneClass =
    tone === "positive"
      ? "text-emerald-700"
      : tone === "negative"
        ? "text-rose-700"
        : "text-foreground";

  return (
    <Card className={emphasized ? "border-foreground/20 shadow-sm" : undefined}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className={cn("text-2xl font-semibold tabular-nums", toneClass)}>
          {rateAvailable ? formatUsd(usd) : "—"}
        </div>
        <div className="mt-1 text-xs text-muted-foreground tabular-nums">
          TRY: {formatTryFull(try_)}
        </div>
        {breakdown && rateAvailable ? (
          <div className="mt-2 flex flex-col gap-0.5 text-xs text-muted-foreground tabular-nums">
            {breakdown.map((b) => (
              <div key={b.label} className="flex items-center justify-between">
                <span>{b.label}</span>
                <span>{formatUsd(b.usd)}</span>
              </div>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
