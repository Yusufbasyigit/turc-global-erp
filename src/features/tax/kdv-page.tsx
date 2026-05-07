"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Download, FileText } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { istanbulYearMonth } from "@/lib/proforma/istanbul-date";
import {
  formatPeriodLabel,
  summarizeKdv,
  type KdvMonth,
} from "@/lib/ledger/kdv-summary";

import { kdvKeys, listKdvWindow, type KdvRow } from "./queries";
import { buildKdvCsv, downloadCsv } from "./csv";
import { buildKdvCsvFilename } from "@/lib/pdf/document-filenames";

const MONTHS_BACK = 12;

let kdvFormatter: Intl.NumberFormat | null = null;
function formatTry(n: number): string {
  try {
    if (!kdvFormatter) {
      kdvFormatter = new Intl.NumberFormat("tr-TR", {
        style: "currency",
        currency: "TRY",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    }
    return kdvFormatter.format(n);
  } catch {
    return `${n.toFixed(2)} TRY`;
  }
}

function netLabel(net: number): string {
  if (net > 0) return `${formatTry(net)} owed`;
  if (net < 0) return `${formatTry(net)} (carry-forward)`;
  return formatTry(0);
}

export function KdvPage() {
  const [exportOpen, setExportOpen] = useState(false);
  const [expandSkipped, setExpandSkipped] = useState(false);

  const rowsQ = useQuery({
    queryKey: kdvKeys.window(MONTHS_BACK),
    queryFn: () => listKdvWindow(MONTHS_BACK),
  });

  const rows: KdvRow[] = rowsQ.data ?? [];
  const summary: KdvMonth[] = useMemo(
    () => summarizeKdv(rows, MONTHS_BACK),
    [rows],
  );

  const totalSkipped = summary.reduce((a, m) => a + m.skipped_count, 0);

  const skippedRows = useMemo(() => {
    if (totalSkipped === 0) return [];
    const periodSet = new Set(summary.map((m) => m.period));
    return rows.filter(
      (r) =>
        r.currency !== "TRY" &&
        r.vat_amount != null &&
        r.kind !== "tax_payment" &&
        periodSet.has(istanbulYearMonth(r.transaction_date)),
    );
  }, [rows, summary, totalSkipped]);

  const handleExport = (period: string) => {
    setExportOpen(false);
    const { csv } = buildKdvCsv(rows, period);
    downloadCsv(buildKdvCsvFilename(period), csv);
  };

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            KDV (Turkish VAT)
          </h1>
          <p className="text-sm text-muted-foreground">
            Monthly VAT collected and paid. All amounts in TRY.
          </p>
        </div>
        <Popover open={exportOpen} onOpenChange={setExportOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" disabled={rowsQ.isLoading}>
              <Download className="mr-2 size-4" />
              Export CSV
              <ChevronDown className="ml-2 size-3 text-muted-foreground" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-56 p-1">
            <div className="max-h-80 overflow-y-auto">
              {summary.map((m) => (
                <button
                  key={m.period}
                  type="button"
                  onClick={() => handleExport(m.period)}
                  className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
                >
                  <span>{formatPeriodLabel(m.period)}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {m.period}
                  </span>
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </header>

      {rowsQ.isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Month</th>
                <th className="px-3 py-2 text-right font-medium">
                  Collected VAT
                </th>
                <th className="px-3 py-2 text-right font-medium">Paid VAT</th>
                <th className="px-3 py-2 text-right font-medium">Net</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {summary.map((m) => (
                <KdvRowView key={m.period} month={m} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalSkipped > 0 ? (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs">
          <button
            type="button"
            onClick={() => setExpandSkipped((v) => !v)}
            className="flex w-full items-center justify-between text-left text-amber-200"
          >
            <span>
              {totalSkipped} transaction{totalSkipped === 1 ? "" : "s"} in this
              window {totalSkipped === 1 ? "is" : "are"} in non-TRY currencies
              and {totalSkipped === 1 ? "is" : "are"} excluded from KDV totals.
            </span>
            <ChevronDown
              className={cn(
                "size-3 transition-transform",
                expandSkipped && "rotate-180",
              )}
            />
          </button>
          {expandSkipped ? (
            <ul className="mt-3 space-y-1 text-muted-foreground">
              {skippedRows.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between gap-4 tabular-nums"
                >
                  <span>
                    {r.transaction_date} · {r.kind} ·{" "}
                    {r.contact_name ?? r.partner_name ?? "—"}
                  </span>
                  <span>
                    {r.amount.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}{" "}
                    {r.currency}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function KdvRowView({ month }: { month: KdvMonth }) {
  const recordHref = `/transactions?action=new&kind=tax_payment&kdv_period=${
    month.period
  }&amount=${Math.max(0, month.net_try)}&currency=TRY&reference_number_placeholder=${encodeURIComponent(
    `BEYAN-${month.period}`,
  )}`;

  const viewHref = month.linked_payment_id
    ? `/transactions?action=edit&id=${month.linked_payment_id}`
    : null;

  const hasActivity = month.collected_vat_try > 0 || month.paid_vat_try > 0;
  const isQuiet = !hasActivity && month.status !== "filed";

  return (
    <tr className={cn("border-t", isQuiet && "text-muted-foreground")}>
      <td className="px-3 py-2 font-medium">
        {formatPeriodLabel(month.period)}
      </td>
      <td className="px-3 py-2 text-right tabular-nums">
        {formatTry(month.collected_vat_try)}
      </td>
      <td className="px-3 py-2 text-right tabular-nums">
        {formatTry(month.paid_vat_try)}
      </td>
      <td
        className={cn(
          "px-3 py-2 text-right tabular-nums",
          month.net_try > 0 && "text-amber-700",
          month.net_try < 0 && "text-emerald-700",
        )}
      >
        {netLabel(month.net_try)}
      </td>
      <td className="px-3 py-2">
        {month.status === "filed" ? (
          <Badge className="border-transparent bg-emerald-500/15 text-emerald-800 hover:bg-emerald-500/25">
            Filed
            {month.linked_payment_reference
              ? ` · ${month.linked_payment_reference}`
              : ""}
          </Badge>
        ) : isQuiet ? (
          <Badge
            variant="outline"
            className="border-border/60 text-muted-foreground"
          >
            No activity
          </Badge>
        ) : (
          <Badge className="border-transparent bg-amber-500/20 text-amber-800 hover:bg-amber-500/30">
            Unfiled
          </Badge>
        )}
      </td>
      <td className="px-3 py-2 text-right">
        {viewHref ? (
          <Button asChild variant="ghost">
            <Link href={viewHref}>
              <FileText className="mr-1.5 size-4" />
              View payment
            </Link>
          </Button>
        ) : isQuiet ? (
          <span className="text-xs text-muted-foreground/70">—</span>
        ) : (
          <Button asChild>
            <Link href={recordHref}>Record payment</Link>
          </Button>
        )}
      </td>
    </tr>
  );
}
