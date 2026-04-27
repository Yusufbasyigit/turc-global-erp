"use client";

import { Badge } from "@/components/ui/badge";
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
import { cn } from "@/lib/utils";
import { formatDateShort, formatUsd } from "@/features/treasury/fx-utils";
import { formatTryFull } from "@/features/dashboard/editorial-format";

import type { PandLRow, RowKind } from "./queries";

export function ProfitLossTable({
  rows,
  rateAvailable,
}: {
  rows: PandLRow[];
  rateAvailable: boolean;
}) {
  const revenue = rows.filter((r) => r.kind === "revenue");
  const expense = rows.filter((r) => r.kind === "expense");

  if (rows.length === 0) {
    return (
      <div className="rounded-md border border-dashed py-10 text-center text-sm text-muted-foreground">
        No revenue or expense transactions in this month.
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={150}>
      <div className="overflow-hidden rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[120px]">Date</TableHead>
              <TableHead>Project</TableHead>
              <TableHead className="w-[80px]">Currency</TableHead>
              <TableHead className="w-[160px] text-right">Native</TableHead>
              <TableHead className="w-[140px] text-right">USD</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <Section
              kind="revenue"
              label="Revenue"
              rows={revenue}
              rateAvailable={rateAvailable}
            />
            <Section
              kind="expense"
              label="Expense"
              rows={expense}
              rateAvailable={rateAvailable}
            />
          </TableBody>
        </Table>
      </div>
    </TooltipProvider>
  );
}

function Section({
  kind,
  label,
  rows,
  rateAvailable,
}: {
  kind: RowKind;
  label: string;
  rows: PandLRow[];
  rateAvailable: boolean;
}) {
  if (rows.length === 0) {
    return (
      <>
        <TableRow className="bg-muted/40">
          <TableCell
            colSpan={5}
            className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
          >
            {label}
          </TableCell>
        </TableRow>
        <TableRow>
          <TableCell
            colSpan={5}
            className="py-3 text-center text-xs italic text-muted-foreground"
          >
            None
          </TableCell>
        </TableRow>
      </>
    );
  }
  return (
    <>
      <TableRow className="bg-muted/40">
        <TableCell
          colSpan={5}
          className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
        >
          {label} · {rows.length}
        </TableCell>
      </TableRow>
      {rows.map((r) => (
        <TableRow key={r.id}>
          <TableCell className="text-sm tabular-nums">
            {formatDateShort(r.date)}
          </TableCell>
          <TableCell className="text-sm">{r.project}</TableCell>
          <TableCell>
            <Badge variant="outline" className="font-mono text-[10px]">
              {r.currency}
            </Badge>
          </TableCell>
          <TableCell
            className={cn(
              "text-right text-sm tabular-nums",
              kind === "expense" ? "text-rose-700" : "text-emerald-700",
            )}
          >
            {r.currency === "TRY"
              ? formatTryFull(r.amountNative)
              : `${r.amountNative.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })} ${r.currency}`}
          </TableCell>
          <TableCell
            className={cn(
              "text-right text-sm tabular-nums",
              kind === "expense" ? "text-rose-700" : "text-emerald-700",
            )}
          >
            {r.amountUsd != null ? (
              formatUsd(r.amountUsd)
            ) : !rateAvailable && r.currency === "TRY" ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="cursor-help text-muted-foreground">—</span>
                </TooltipTrigger>
                <TooltipContent>
                  Set the USD/TRY rate for this month to convert TRY entries.
                </TooltipContent>
              </Tooltip>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="cursor-help text-muted-foreground">—</span>
                </TooltipTrigger>
                <TooltipContent>
                  {r.currency} is not auto-converted in P&L.
                </TooltipContent>
              </Tooltip>
            )}
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}
