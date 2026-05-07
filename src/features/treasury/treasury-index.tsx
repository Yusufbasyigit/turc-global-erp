"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, ArrowRightLeft } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type {
  AccountWithCustody,
  FxSnapshot,
  PriceSnapshot,
  TreasuryMovement,
} from "@/lib/supabase/types";

import {
  computeBalanceMap,
  latestByKey,
  listAccountsWithCustody,
  listAllMovements,
  listCustodyLocations,
  listFxSnapshots,
  listPriceSnapshots,
  treasuryKeys,
  useLastRefreshRun,
} from "./queries";
import {
  logRefreshRun,
  refreshFxSnapshots,
  refreshPriceSnapshots,
  refreshTickerRegistry,
} from "./refresh-engine";
import { createClient } from "@/lib/supabase/client";
import {
  formatDateShort,
  formatQuantity,
  formatRelativeTime,
  formatUsd,
  isFxStale,
  isRefreshDelayed,
  latestFxFetchedAt,
  unitPriceFor,
  usdValueFor,
} from "./fx-utils";
import { ASSET_TYPE_LABELS } from "./constants";
import { RecordMovementDialog } from "./record-movement-dialog";

type Grouping = "asset_type" | "custody" | "flat";

export function TreasuryIndex() {
  const qc = useQueryClient();
  const [grouping, setGrouping] = useState<Grouping>("asset_type");
  const [moveOpen, setMoveOpen] = useState(false);

  const [showZero, setShowZero] = useState(false);

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
  const custodyQ = useQuery({
    queryKey: treasuryKeys.custody(),
    queryFn: () => listCustodyLocations({ activeOnly: false }),
  });

  const accounts = accountsQ.data ?? [];
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

  const stale = isFxStale(fxMap);
  const latestFxDate = latestFxFetchedAt(fxMap);

  const lastRunQ = useLastRefreshRun();

  const refreshMut = useMutation({
    mutationFn: async () => {
      if (accounts.length === 0) {
        throw new Error("No wallets yet. Create one in Accounts first.");
      }
      const client = createClient();
      // Refresh the ticker registry first so price lookup can resolve any
      // newly-added crypto ticker on this same run. Best-effort; failure
      // here is non-fatal — fx + price still proceed.
      await refreshTickerRegistry(client).catch((e: unknown) => {
        console.error("ticker_registry refresh failed:", e);
      });
      const [fxResult, priceResult] = await Promise.allSettled([
        refreshFxSnapshots(client),
        refreshPriceSnapshots(client),
      ]);
      await logRefreshRun(client, "manual", fxResult, priceResult);
      return { fxResult, priceResult };
    },
    onSuccess: ({ fxResult, priceResult }) => {
      qc.invalidateQueries({ queryKey: treasuryKeys.fx() });
      qc.invalidateQueries({ queryKey: treasuryKeys.prices() });
      qc.invalidateQueries({ queryKey: treasuryKeys.refreshRuns() });

      const parts: string[] = [];
      if (fxResult.status === "fulfilled") {
        parts.push(`${fxResult.value.inserted} FX`);
        if (fxResult.value.errors.length > 0) {
          toast.error(`FX errors: ${fxResult.value.errors.join(", ")}`);
        }
      } else {
        toast.error(`FX: ${fxResult.reason?.message ?? "failed"}`);
      }
      if (priceResult.status === "fulfilled") {
        const { inserted, skipped, errors } = priceResult.value;
        parts.push(`${inserted} price(s)`);
        if (skipped.length > 0) {
          toast.message(
            `No price source for: ${skipped.join(", ")}`,
            { description: "Rename the asset code to a standard ticker (e.g. BTC, XAU) to auto-price it." },
          );
        }
        if (errors.length > 0) {
          toast.error(`Price errors: ${errors.join(", ")}`);
        }
      } else {
        toast.error(`Prices: ${priceResult.reason?.message ?? "failed"}`);
      }
      if (parts.length > 0) toast.success(`Refreshed ${parts.join(" + ")}`);
    },
    onError: (e: Error) => toast.error(e.message ?? "Refresh failed"),
  });

  const zeroCount = useMemo(
    () => accounts.filter((a) => (balances.get(a.id) ?? 0) === 0).length,
    [accounts, balances],
  );

  const totals = useMemo(() => {
    let priced = 0;
    let unpricedCount = 0;
    for (const a of accounts) {
      const qty = balances.get(a.id) ?? 0;
      if (qty === 0) continue;
      const usd = usdValueFor(a, qty, fxMap, priceMap);
      if (usd === null) {
        unpricedCount += 1;
      } else {
        priced += usd;
      }
    }
    return { priced, unpricedCount };
  }, [accounts, balances, fxMap, priceMap]);
  const visibleAccounts = useMemo(
    () =>
      showZero
        ? accounts
        : accounts.filter((a) => (balances.get(a.id) ?? 0) !== 0),
    [accounts, balances, showZero],
  );

  const isLoading =
    accountsQ.isLoading ||
    movementsQ.isLoading ||
    fxQ.isLoading ||
    pricesQ.isLoading ||
    custodyQ.isLoading;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Treasury</h1>
          <p className="text-sm text-muted-foreground">
            Holdings across every custody, in native units. USD is display only.
          </p>
          <div className="mt-3 flex items-baseline gap-3">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">
              Total
            </span>
            <span
              className={cn(
                "text-3xl font-semibold tabular-nums tracking-tight",
                stale && "text-muted-foreground",
              )}
              title={
                stale
                  ? "FX rates are more than 24 hours old — click Refresh rates"
                  : undefined
              }
            >
              {formatUsd(totals.priced)}
            </span>
            {totals.unpricedCount > 0 ? (
              <span
                className="text-xs text-muted-foreground"
                title="Holdings without a price snapshot are excluded from the total."
              >
                +{totals.unpricedCount} unpriced
              </span>
            ) : null}
          </div>
          <p
            className={cn(
              "mt-1 text-xs",
              stale ? "text-muted-foreground italic" : "text-muted-foreground",
            )}
            title={
              stale
                ? "FX rates are more than 24 hours old — click Refresh rates"
                : undefined
            }
          >
            USD view — rates from {formatDateShort(latestFxDate)}
            {stale ? " (stale)" : ""}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>
              Last refresh:{" "}
              {lastRunQ.data
                ? `${formatRelativeTime(lastRunQ.data.ran_at)} (${
                    lastRunQ.data.triggered_by === "cron" ? "auto" : "manual"
                  })`
                : "never"}
            </span>
            {isRefreshDelayed(lastRunQ.data ?? null) && lastRunQ.isSuccess ? (
              <span
                className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-amber-500"
                title="The scheduled auto-refresh hasn't run when expected — check the Supabase function logs."
              >
                Auto-refresh delayed — check function logs
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => refreshMut.mutate()}
            disabled={refreshMut.isPending || accounts.length === 0}
          >
            <RefreshCw
              className={cn(
                "mr-2 size-4",
                refreshMut.isPending && "animate-spin",
              )}
            />
            {refreshMut.isPending ? "Refreshing…" : "Refresh rates"}
          </Button>
          <Button variant="outline" onClick={() => setMoveOpen(true)}>
            <ArrowRightLeft className="mr-2 size-4" />
            Record movement
          </Button>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-1 text-xs">
        <span className="text-muted-foreground">Group by:</span>
        <SegmentedButton
          active={grouping === "asset_type"}
          onClick={() => setGrouping("asset_type")}
        >
          Asset type
        </SegmentedButton>
        <SegmentedButton
          active={grouping === "custody"}
          onClick={() => setGrouping("custody")}
        >
          Custody
        </SegmentedButton>
        <SegmentedButton
          active={grouping === "flat"}
          onClick={() => setGrouping("flat")}
        >
          Flat
        </SegmentedButton>
        {zeroCount > 0 ? (
          <button
            type="button"
            onClick={() => setShowZero((v) => !v)}
            className="ml-auto rounded-full border border-border px-2.5 py-1 text-muted-foreground transition-colors hover:bg-muted"
            title={
              showZero
                ? "Hide wallets with zero balance"
                : "Show wallets with zero balance"
            }
          >
            {showZero
              ? `Hide 0-balance (${zeroCount})`
              : `Show 0-balance (${zeroCount})`}
          </button>
        ) : null}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : accounts.length === 0 ? (
        <EmptyState />
      ) : (
        <HoldingsGroups
          accounts={visibleAccounts}
          balances={balances}
          fxMap={fxMap}
          priceMap={priceMap}
          stale={stale}
          grouping={grouping}
        />
      )}

      <RecordMovementDialog
        open={moveOpen}
        onOpenChange={setMoveOpen}
        accounts={accounts}
      />
    </div>
  );
}

function SegmentedButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-2.5 py-1 transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border text-muted-foreground hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-dashed p-10 text-center">
      <p className="text-sm text-muted-foreground">
        No wallets yet. Create one in Accounts to get started.
      </p>
      <Button asChild className="mt-4">
        <Link href="/accounts">Go to Accounts</Link>
      </Button>
    </div>
  );
}

function HoldingsGroups({
  accounts,
  balances,
  fxMap,
  priceMap,
  stale,
  grouping,
}: {
  accounts: AccountWithCustody[];
  balances: Map<string, number>;
  fxMap: Map<string, FxSnapshot>;
  priceMap: Map<string, PriceSnapshot>;
  stale: boolean;
  grouping: Grouping;
}) {
  const groups = useMemo(() => {
    if (grouping === "flat") {
      return [{ key: "all", label: "All holdings", items: accounts }];
    }
    const map = new Map<string, { key: string; label: string; items: AccountWithCustody[] }>();
    for (const a of accounts) {
      let key: string;
      let label: string;
      if (grouping === "asset_type") {
        key = a.asset_type ?? "unknown";
        label =
          ASSET_TYPE_LABELS[a.asset_type as keyof typeof ASSET_TYPE_LABELS] ??
          "Unknown";
      } else {
        key = a.custody_locations?.id ?? "__none";
        label = a.custody_locations?.name ?? "No custody";
      }
      const bucket = map.get(key);
      if (bucket) bucket.items.push(a);
      else map.set(key, { key, label, items: [a] });
    }
    return Array.from(map.values()).sort((x, y) =>
      x.label.localeCompare(y.label),
    );
  }, [accounts, grouping]);

  return (
    <div className="space-y-6">
      {groups.map((g) => (
        <section key={g.key} className="space-y-2">
          {grouping !== "flat" ? (
            <h2 className="text-sm font-medium text-muted-foreground">
              {g.label} ({g.items.length})
            </h2>
          ) : null}
          <HoldingsTable
            accounts={g.items}
            balances={balances}
            fxMap={fxMap}
            priceMap={priceMap}
            stale={stale}
          />
        </section>
      ))}
    </div>
  );
}

function HoldingsTable({
  accounts,
  balances,
  fxMap,
  priceMap,
  stale,
}: {
  accounts: AccountWithCustody[];
  balances: Map<string, number>;
  fxMap: Map<string, FxSnapshot>;
  priceMap: Map<string, PriceSnapshot>;
  stale: boolean;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">Asset</th>
            <th className="px-3 py-2 font-medium">Custody</th>
            <th className="px-3 py-2 text-right font-medium">Quantity</th>
            <th className="px-3 py-2 text-right font-medium">Unit price</th>
            <th className="px-3 py-2 text-right font-medium">USD value</th>
            <th className="px-3 py-2 font-medium">Last FX</th>
          </tr>
        </thead>
        <tbody>
          {accounts.map((a) => {
            const qty = balances.get(a.id) ?? 0;
            const zero = qty === 0;
            const price = unitPriceFor(a, priceMap);
            const usd = usdValueFor(a, qty, fxMap, priceMap);
            const fxCurrency =
              a.asset_type === "fiat"
                ? a.asset_code?.toUpperCase()
                : price?.currency?.toUpperCase();
            const fxRow = fxCurrency ? fxMap.get(fxCurrency) : undefined;

            return (
              <tr
                key={a.id}
                className={cn(
                  "border-t",
                  zero && "opacity-60",
                )}
              >
                <td className="px-3 py-2">
                  <div className="font-medium">{a.asset_code ?? "—"}</div>
                  <div className="text-xs text-muted-foreground">
                    {a.account_name}
                  </div>
                </td>
                <td className="px-3 py-2">
                  {a.custody_locations?.name ?? "—"}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatQuantity(qty)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {price
                    ? `${formatQuantity(price.price)} ${price.currency}`
                    : "—"}
                </td>
                <td
                  className={cn(
                    "px-3 py-2 text-right tabular-nums",
                    stale && "text-muted-foreground",
                  )}
                >
                  {formatUsd(usd)}
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {fxRow ? formatDateShort(fxRow.fetched_at) : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
