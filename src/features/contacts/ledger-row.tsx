"use client";

import { memo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ChevronDown, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  TRANSACTION_KIND_BADGE_CLASSES,
  TRANSACTION_KIND_LABELS,
} from "@/features/transactions/constants";
import type { TransactionKind } from "@/lib/supabase/types";
import type { ContactLedgerRow } from "@/features/transactions/queries";
import type { PaymentAllocationDetail } from "@/lib/ledger/fifo-allocation";
import { formatDateOnly } from "@/lib/format-date";

function formatMoney(n: number): string {
  return Number(n).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

const formatDate = (d: string | null) => formatDateOnly(d);

const EMPTY_ALLOCATIONS: readonly PaymentAllocationDetail[] = [];

function LedgerRowImpl({
  row,
  signedAmount,
  runningBalance,
  skipped,
  displayCurrency,
  allocations,
}: {
  row: ContactLedgerRow;
  signedAmount: number | null;
  runningBalance: number | null;
  skipped: boolean;
  displayCurrency: string;
  allocations: readonly PaymentAllocationDetail[];
}) {
  const [open, setOpen] = useState(false);
  const isBilling = row.kind === "shipment_billing";
  const canExpand = isBilling && !skipped;

  const kindClass =
    TRANSACTION_KIND_BADGE_CLASSES[row.kind as TransactionKind] ?? "";
  const kindLabel =
    TRANSACTION_KIND_LABELS[row.kind as TransactionKind] ?? row.kind;

  let tone = "text-foreground";
  if (!skipped && signedAmount !== null) {
    if (signedAmount > 0) tone = "text-rose-700";
    else if (signedAmount < 0) tone = "text-emerald-700";
  }

  const rowAllocations = canExpand ? allocations : EMPTY_ALLOCATIONS;

  return (
    <>
      <tr
        className={cn(
          "hover:bg-muted/30",
          skipped && "opacity-60",
          canExpand && "cursor-pointer",
        )}
        onClick={canExpand ? () => setOpen((v) => !v) : undefined}
      >
        <td className="px-3 py-2 text-xs tabular-nums">
          {canExpand ? (
            <span className="mr-1 inline-flex align-middle">
              {open ? (
                <ChevronDown className="size-3.5" />
              ) : (
                <ChevronRight className="size-3.5" />
              )}
            </span>
          ) : null}
          {formatDate(row.transaction_date)}
        </td>
        <td className="px-3 py-2">
          <Badge className={cn("text-[10px]", kindClass)}>{kindLabel}</Badge>
        </td>
        <td className="px-3 py-2 text-xs">
          {row.related_shipment ? (
            <Link
              href={`/shipments/${row.related_shipment.id}`}
              className="text-primary hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {row.related_shipment.name ?? row.related_shipment.id.slice(0, 8)}
            </Link>
          ) : (
            <span className="text-muted-foreground">
              {row.reference_number ?? row.description ?? "—"}
            </span>
          )}
        </td>
        <td
          className={cn("px-3 py-2 text-right text-xs tabular-nums", tone)}
          title={
            skipped
              ? `Original: ${formatMoney(Number(row.amount))} ${row.currency}. No frozen FX to ${displayCurrency} — excluded from totals.`
              : undefined
          }
        >
          {skipped ? (
            <span className="inline-flex items-center gap-1">
              <AlertTriangle className="size-3 text-amber-700" />
              {formatMoney(Number(row.amount))} {row.currency}
            </span>
          ) : signedAmount !== null ? (
            <>
              {signedAmount > 0 ? "+" : ""}
              {formatMoney(signedAmount)} {displayCurrency}
            </>
          ) : (
            "—"
          )}
        </td>
        <td className="px-3 py-2 text-right text-xs tabular-nums">
          {runningBalance === null ? (
            "—"
          ) : (
            <>
              {formatMoney(runningBalance)} {displayCurrency}
            </>
          )}
        </td>
      </tr>
      {canExpand && open ? (
        <tr className="bg-muted/20">
          <td colSpan={5} className="px-3 py-3">
            {rowAllocations.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">
                No payments have been applied to this billing yet.
              </p>
            ) : (
              <ul className="space-y-1 text-[11px]">
                {rowAllocations.map((a) => (
                  <li
                    key={`${a.payment_event_id}-${a.shipment_billing_id}`}
                    className="tabular-nums"
                  >
                    <span className="text-muted-foreground">
                      {formatDate(a.payment_date)}
                    </span>{" "}
                    ·{" "}
                    <span className="font-medium text-emerald-700">
                      {formatMoney(a.allocated_amount)} {displayCurrency}
                    </span>{" "}
                    <span className="text-muted-foreground">
                      from payment {a.payment_event_id.slice(0, 8)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </td>
        </tr>
      ) : null}
    </>
  );
}

export const LedgerRow = memo(LedgerRowImpl);
