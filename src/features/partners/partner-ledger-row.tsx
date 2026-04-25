"use client";

import { memo } from "react";
import { ArrowDownLeft, ArrowUpRight, Minus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format-money";
import type { PartnerTransactionRow } from "./queries/partner-transactions";
import { PARTNER_LEDGER_KIND_LABELS } from "./partner-ledger-filters";

const KIND_BADGE_CLASSES: Record<string, string> = {
  partner_loan_in:
    "border-transparent bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/20",
  partner_loan_out:
    "border-transparent bg-rose-500/15 text-rose-300 hover:bg-rose-500/20",
  profit_distribution:
    "border-transparent bg-violet-500/15 text-violet-300 hover:bg-violet-500/20",
  expense:
    "border-transparent bg-amber-500/15 text-amber-300 hover:bg-amber-500/20",
  adjustment:
    "border-transparent bg-zinc-500/15 text-zinc-300 hover:bg-zinc-500/20",
};

function formatDate(d: string): string {
  try {
    const parts = d.slice(0, 10).split("-");
    if (parts.length === 3) return `${parts[2]}.${parts[1]}.${parts[0]}`;
    return d;
  } catch {
    return d;
  }
}

function truncate(text: string, max = 60): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export type LedgerDirection = "in" | "out" | "neutral";

export function directionFor(row: PartnerTransactionRow): LedgerDirection {
  if (row.kind === "partner_loan_in") return "in";
  if (row.kind === "partner_loan_out") return "out";
  if (row.kind === "profit_distribution") return "out";
  if (row.kind === "expense") {
    // Partner-paid expense is a claim (partner is owed); no business cash moves.
    return "neutral";
  }
  return "neutral";
}

function signedAmountFor(row: PartnerTransactionRow): number {
  const dir = directionFor(row);
  const amt = Number(row.amount);
  if (dir === "in") return amt;
  if (dir === "out") return -amt;
  return 0;
}

export function partnerRowSignedAmount(
  row: PartnerTransactionRow,
): number {
  return signedAmountFor(row);
}

function PartnerLedgerRowImpl({
  row,
  runningTally,
  tallyCurrency,
}: {
  row: PartnerTransactionRow;
  runningTally: number | null;
  tallyCurrency: string;
}) {
  const dir = directionFor(row);
  const amt = Number(row.amount);
  const kindLabel = PARTNER_LEDGER_KIND_LABELS[row.kind] ?? row.kind;
  const kindClass = KIND_BADGE_CLASSES[row.kind] ?? KIND_BADGE_CLASSES.adjustment;

  let amountTone = "text-foreground";
  if (dir === "in") amountTone = "text-emerald-300";
  else if (dir === "out") amountTone = "text-rose-300";

  const accountName = row.from_account
    ? row.from_account.account_name
    : row.to_account
      ? row.to_account.account_name
      : null;

  const description = row.description?.trim()
    ? truncate(row.description.trim())
    : null;

  const tallyMatchesCurrency = row.currency === tallyCurrency;
  const signed = signedAmountFor(row);

  return (
    <tr className="hover:bg-muted/30">
      <td className="px-3 py-2 text-xs tabular-nums whitespace-nowrap">
        {formatDate(row.transaction_date)}
      </td>
      <td className="px-3 py-2">
        <Badge className={cn("text-[10px]", kindClass)}>{kindLabel}</Badge>
      </td>
      <td className="px-3 py-2 text-center">
        <DirectionIcon dir={dir} />
      </td>
      <td
        className="max-w-[240px] truncate px-3 py-2 text-xs text-muted-foreground"
        title={row.description ?? undefined}
      >
        {description ?? "—"}
      </td>
      <td className="px-3 py-2 text-xs text-muted-foreground">
        {accountName ?? "—"}
      </td>
      <td className={cn("px-3 py-2 text-right text-xs tabular-nums", amountTone)}>
        {signed > 0 ? "+" : signed < 0 ? "−" : ""}
        {formatCurrency(amt, row.currency)}
      </td>
      <td className="px-3 py-2 text-right text-xs tabular-nums">
        {runningTally === null || !tallyMatchesCurrency ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          formatCurrency(runningTally, tallyCurrency)
        )}
      </td>
    </tr>
  );
}

export const PartnerLedgerRow = memo(PartnerLedgerRowImpl);

function DirectionIcon({ dir }: { dir: LedgerDirection }) {
  if (dir === "in")
    return (
      <ArrowDownLeft
        className="mx-auto size-3.5 text-emerald-400"
        aria-label="Money to business"
      />
    );
  if (dir === "out")
    return (
      <ArrowUpRight
        className="mx-auto size-3.5 text-rose-400"
        aria-label="Money from business"
      />
    );
  return (
    <Minus
      className="mx-auto size-3.5 text-muted-foreground"
      aria-label="No cash impact"
    />
  );
}
