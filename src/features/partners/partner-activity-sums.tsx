"use client";

import { useMemo } from "react";
import { ArrowDownLeft, ArrowUpRight, Receipt } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format-money";
import type { PartnerTransactionRow } from "./queries/partner-transactions";

type Totals = Record<string, number>;

function sumBy(
  rows: PartnerTransactionRow[],
  predicate: (r: PartnerTransactionRow) => boolean,
): Totals {
  const totals: Totals = {};
  for (const r of rows) {
    if (!predicate(r)) continue;
    totals[r.currency] = (totals[r.currency] ?? 0) + Number(r.amount);
  }
  return totals;
}

const formatMoney = formatCurrency;

function sortedEntries(totals: Totals): [string, number][] {
  return Object.entries(totals).sort((a, b) => b[1] - a[1]);
}

export function PartnerActivitySums({
  rows,
}: {
  rows: PartnerTransactionRow[];
}) {
  const loansIn = useMemo(
    () => sumBy(rows, (r) => r.kind === "partner_loan_in"),
    [rows],
  );
  const loansOut = useMemo(
    () => sumBy(rows, (r) => r.kind === "partner_loan_out"),
    [rows],
  );
  const partnerPaidExpenses = useMemo(
    () =>
      sumBy(
        rows,
        (r) =>
          r.kind === "expense" &&
          Boolean(r.partner_id) &&
          !r.from_account_id,
      ),
    [rows],
  );

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
      <SumCard
        icon={<ArrowDownLeft className="size-4 text-emerald-400" />}
        label="Loans received"
        subtitle="Money into the business"
        totals={loansIn}
      />
      <SumCard
        icon={<ArrowUpRight className="size-4 text-sky-400" />}
        label="Loans returned & reimbursements paid"
        subtitle="Money out to the partner"
        totals={loansOut}
      />
      <SumCard
        icon={<Receipt className="size-4 text-amber-400" />}
        label="Partner-paid expenses"
        subtitle="Lifetime, regardless of settlement"
        totals={partnerPaidExpenses}
      />
    </div>
  );
}

function SumCard({
  icon,
  label,
  subtitle,
  totals,
}: {
  icon: React.ReactNode;
  label: string;
  subtitle: string;
  totals: Totals;
}) {
  const entries = sortedEntries(totals);
  const [main, ...rest] = entries;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          {icon}
          <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="pb-4">
        {!main ? (
          <>
            <p className="text-xl font-semibold tabular-nums text-muted-foreground">
              —
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">{subtitle}</p>
          </>
        ) : (
          <>
            <p className="text-xl font-semibold tabular-nums">
              {formatMoney(main[1], main[0])}
            </p>
            {rest.length > 0 ? (
              <ul className="mt-1 space-y-0.5">
                {rest.map(([currency, amount]) => (
                  <li
                    key={currency}
                    className="text-[11px] tabular-nums text-muted-foreground"
                  >
                    {formatMoney(amount, currency)}
                  </li>
                ))}
              </ul>
            ) : null}
            <p className="mt-1 text-[11px] text-muted-foreground">{subtitle}</p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
