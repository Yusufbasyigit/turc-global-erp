"use client";

import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LedgerAllocationResult } from "@/lib/ledger/fifo-allocation";

function formatMoney(n: number): string {
  return Number(n).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function LedgerHeader({
  fifo,
  displayCurrency,
}: {
  fifo: LedgerAllocationResult;
  displayCurrency: string;
}) {
  const netBalance = fifo.net_balance;
  const netTone =
    netBalance > 0.001
      ? "text-rose-300"
      : netBalance < -0.001
        ? "text-emerald-300"
        : "text-muted-foreground";
  const netLabel =
    netBalance > 0.001
      ? "owes us"
      : netBalance < -0.001
        ? "we owe them"
        : "settled";

  return (
    <div className="flex flex-wrap items-end justify-between gap-4 rounded-md border p-3">
      <div>
        <div className="text-[10px] uppercase text-muted-foreground">
          Net balance
        </div>
        <div className={cn("mt-1 text-2xl font-semibold tabular-nums", netTone)}>
          {formatMoney(Math.abs(netBalance))} {displayCurrency}
        </div>
        <div className="text-[11px] text-muted-foreground">{netLabel}</div>
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs sm:grid-cols-4">
        <SubStat
          label="Total billed"
          value={`${formatMoney(fifo.total_billed)} ${displayCurrency}`}
        />
        <SubStat
          label="Total paid"
          value={`${formatMoney(fifo.total_paid)} ${displayCurrency}`}
        />
        {fifo.unallocated_credit > 0 ? (
          <SubStat
            label="Unallocated credit"
            value={`${formatMoney(fifo.unallocated_credit)} ${displayCurrency}`}
            tone="emerald"
          />
        ) : null}
        {fifo.skipped_events.length > 0 ? (
          <SubStat
            label="Skipped events"
            value={String(fifo.skipped_events.length)}
            tone="amber"
            tooltip={fifo.skipped_events
              .map(
                (s) =>
                  `${s.event.kind} ${formatMoney(Number(s.event.amount))} ${s.event.currency} (${s.event.date})`,
              )
              .join("\n")}
          />
        ) : null}
      </div>
    </div>
  );
}

function SubStat({
  label,
  value,
  tone,
  tooltip,
}: {
  label: string;
  value: string;
  tone?: "emerald" | "amber";
  tooltip?: string;
}) {
  const toneClass =
    tone === "emerald"
      ? "text-emerald-300"
      : tone === "amber"
        ? "text-amber-300"
        : "text-foreground";
  return (
    <div title={tooltip}>
      <div className="flex items-center gap-1 text-[10px] uppercase text-muted-foreground">
        {label}
        {tone === "amber" ? <AlertTriangle className="size-3" /> : null}
      </div>
      <div className={cn("mt-0.5 tabular-nums", toneClass)}>{value}</div>
    </div>
  );
}
