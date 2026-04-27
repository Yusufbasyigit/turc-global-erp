"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format-money";
import type {
  AccountWithCustody,
  FxSnapshot,
  PriceSnapshot,
  RateRefreshRun,
  TreasuryMovement,
} from "@/lib/supabase/types";

import {
  computeBalanceMap,
  latestByKey,
  listAccountsWithCustody,
  listAllMovements,
  listFxSnapshots,
  listPriceSnapshots,
  treasuryKeys,
  useLastRefreshRun,
} from "@/features/treasury/queries";
import {
  formatDateShort,
  formatUsd,
  isFxStale,
  latestFxFetchedAt,
  usdValueFor,
} from "@/features/treasury/fx-utils";

import {
  useArOutstanding,
  usePendingReimbursementsAggregate,
} from "./queries";

// ------------------------------------------------------------ shared shell

function CardShell({
  title,
  href,
  children,
  className,
}: {
  title: string;
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("group/snapshot relative", className)}>
      <Link
        href={href}
        aria-label={`${title} — open module`}
        className="absolute inset-0 z-10 rounded-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
      />
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {title}
        </CardTitle>
        <ChevronRight className="size-4 text-primary opacity-60 transition group-hover/snapshot:opacity-100" />
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function ErrorTile({
  title,
  message,
  onRetry,
  href,
}: {
  title: string;
  message: string;
  onRetry: () => void;
  href: string;
}) {
  return (
    <Card className="relative">
      <Link
        href={href}
        aria-label={`${title} — open module`}
        className="absolute inset-0 z-0 rounded-xl"
      />
      <CardHeader>
        <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="relative z-20">
        <p className="text-sm text-muted-foreground">{message}</p>
        <Button
          size="sm"
          variant="outline"
          className="mt-2"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onRetry();
          }}
        >
          Retry
        </Button>
      </CardContent>
    </Card>
  );
}

// ------------------------------------------------------------ Card 1: Treasury

function refreshFailureMessage(run: RateRefreshRun | null | undefined): string | null {
  if (!run) return null;
  if (run.error_message) return run.error_message;
  const fxErr = run.fx_outcome?.errors?.[0];
  if (fxErr) return `FX refresh: ${fxErr}`;
  const priceErr = run.price_outcome?.errors?.[0];
  if (priceErr) return `Price refresh: ${priceErr}`;
  return null;
}

export function TreasurySnapshotCard() {
  const accountsQ = useQuery({
    queryKey: treasuryKeys.accounts(),
    queryFn: listAccountsWithCustody,
  });
  const movementsQ = useQuery({
    queryKey: treasuryKeys.movements(),
    queryFn: listAllMovements,
  });
  const fxQ = useQuery({
    queryKey: treasuryKeys.fx(),
    queryFn: listFxSnapshots,
  });
  const pricesQ = useQuery({
    queryKey: treasuryKeys.prices(),
    queryFn: listPriceSnapshots,
  });
  const lastRunQ = useLastRefreshRun();

  const isLoading =
    accountsQ.isLoading ||
    movementsQ.isLoading ||
    fxQ.isLoading ||
    pricesQ.isLoading;
  const isError =
    accountsQ.isError || movementsQ.isError || fxQ.isError || pricesQ.isError;

  const accounts: AccountWithCustody[] = accountsQ.data ?? [];
  const movements: TreasuryMovement[] = movementsQ.data ?? [];
  const fxRows: FxSnapshot[] = fxQ.data ?? [];
  const priceRows: PriceSnapshot[] = pricesQ.data ?? [];

  const balances = useMemo(() => computeBalanceMap(movements), [movements]);
  const fxMap = useMemo(
    () =>
      latestByKey(
        fxRows,
        (r) => r.currency_code.toUpperCase(),
        (r) => r.fetched_at,
      ),
    [fxRows],
  );
  const priceMap = useMemo(
    () =>
      latestByKey(
        priceRows,
        (r) => r.asset_code,
        (r) => r.snapshot_date,
      ),
    [priceRows],
  );

  const totals = useMemo(() => {
    let priced = 0;
    let unpricedCount = 0;
    for (const a of accounts) {
      const qty = balances.get(a.id) ?? 0;
      if (qty === 0) continue;
      const usd = usdValueFor(a, qty, fxMap, priceMap);
      if (usd === null) unpricedCount += 1;
      else priced += usd;
    }
    return { priced, unpricedCount };
  }, [accounts, balances, fxMap, priceMap]);

  const stale = isFxStale(fxMap);
  const latestFxDate = latestFxFetchedAt(fxMap);
  const refreshError = refreshFailureMessage(lastRunQ.data);

  if (isError) {
    return (
      <ErrorTile
        title="Treasury value"
        message="Couldn't load treasury value."
        href="/treasury"
        onRetry={() => {
          accountsQ.refetch();
          movementsQ.refetch();
          fxQ.refetch();
          pricesQ.refetch();
          lastRunQ.refetch();
        }}
      />
    );
  }

  return (
    <CardShell title="Treasury value" href="/treasury">
      {isLoading ? (
        <>
          <Skeleton className="h-9 w-32" />
          <Skeleton className="mt-2 h-4 w-40" />
        </>
      ) : (
        <>
          <div
            className={cn(
              "text-3xl font-semibold tabular-nums tracking-tight",
              stale && "text-muted-foreground",
            )}
            title={
              stale
                ? "FX rates are more than 24 hours old — refresh from /treasury"
                : undefined
            }
          >
            {formatUsd(totals.priced)}
            {totals.unpricedCount > 0 ? (
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                +{totals.unpricedCount} unpriced
              </span>
            ) : null}
          </div>
          <p
            className={cn(
              "mt-1 flex items-center gap-1.5 text-xs text-muted-foreground",
              stale && "italic",
            )}
          >
            <span>
              Rates from {formatDateShort(latestFxDate)}
              {stale ? " (stale)" : ""}
            </span>
            {refreshError ? (
              <span
                className="relative z-20 inline-block size-2 rounded-full bg-destructive"
                title={`Last refresh failed: ${refreshError}`}
                aria-label={`Last refresh failed: ${refreshError}`}
              />
            ) : null}
          </p>
        </>
      )}
    </CardShell>
  );
}

// ------------------------------------------------------------ shared formatter

function formatPerCurrencyLine(
  totals: Map<string, number>,
  emptyText: string,
): React.ReactNode {
  if (totals.size === 0) {
    return <p className="text-sm text-muted-foreground">{emptyText}</p>;
  }
  const entries = Array.from(totals.entries()).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  return (
    <ul className="flex flex-wrap items-center gap-x-3 gap-y-1 text-base font-semibold tabular-nums">
      {entries.map(([currency, amount], i) => (
        <li key={currency} className="flex items-center gap-3">
          <span>{formatCurrency(amount, currency)}</span>
          {i < entries.length - 1 ? (
            <span className="text-muted-foreground">·</span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

// ------------------------------------------------------------ Card 2: AR

export function ArOutstandingCard() {
  const ar = useArOutstanding();

  if (ar.isError) {
    return (
      <ErrorTile
        title="AR outstanding"
        message="Couldn't load AR outstanding."
        href="/shipments"
        onRetry={ar.refetch}
      />
    );
  }

  return (
    <CardShell title="AR outstanding" href="/shipments">
      {ar.isLoading || !ar.data ? (
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-7 w-24" />
          <Skeleton className="h-7 w-24" />
          <Skeleton className="h-7 w-24" />
        </div>
      ) : (
        formatPerCurrencyLine(ar.data, "No outstanding balances.")
      )}
    </CardShell>
  );
}

// ------------------------------------------------------------ Card 3: Reimbursements

export function PartnerReimbursementCard() {
  const agg = usePendingReimbursementsAggregate();

  if (agg.isError) {
    return (
      <ErrorTile
        title="Pending reimbursements"
        message="Couldn't load pending reimbursements."
        href="/partners"
        onRetry={agg.refetch}
      />
    );
  }

  return (
    <CardShell title="Pending reimbursements" href="/partners">
      {agg.isLoading || !agg.data ? (
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-7 w-24" />
          <Skeleton className="h-7 w-24" />
          <Skeleton className="h-7 w-24" />
        </div>
      ) : (
        formatPerCurrencyLine(agg.data, "No pending reimbursements.")
      )}
    </CardShell>
  );
}
