"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeftRight,
  ArrowRight,
  ArrowUpRight,
  Pencil,
  Plus,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { AccountWithCustody, MovementKind } from "@/lib/supabase/types";

import {
  computeBalanceMap,
  latestByKey,
  listAccountsWithCustody,
  listAllMovements,
  listFxSnapshots,
  listPriceSnapshots,
  treasuryKeys,
} from "@/features/treasury/queries";
import {
  formatDateShort,
  formatQuantity,
  formatUsd,
  isFxStale,
  latestFxFetchedAt,
  usdValueFor,
} from "@/features/treasury/fx-utils";
import {
  MOVEMENT_KIND_LABELS,
  PAIRED_KINDS,
} from "@/features/treasury/constants";
import { RecordMovementDialog } from "@/features/treasury/record-movement-dialog";
import {
  TransactionFormDialog,
  type TransactionPrefill,
} from "@/features/transactions/transaction-form-dialog";
import {
  TRANSACTION_KIND_BADGE_CLASSES,
  TRANSACTION_KIND_LABELS,
} from "@/features/transactions/constants";

import {
  accountKeys,
  getAccountWithCustody,
  listAccountLedger,
  type LedgerMovement,
  type PairedLegPeer,
} from "./queries";
import { AccountFormDialog } from "./account-form-dialog";

export function AccountDetail({ accountId }: { accountId: string }) {
  const [editOpen, setEditOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [moveDefaultKind, setMoveDefaultKind] = useState<
    MovementKind | undefined
  >(undefined);
  const [txnOpen, setTxnOpen] = useState(false);

  const accountQ = useQuery({
    queryKey: accountKeys.detail(accountId),
    queryFn: () => getAccountWithCustody(accountId),
  });

  const ledgerQ = useQuery({
    queryKey: accountKeys.ledger(accountId),
    queryFn: () => listAccountLedger(accountId),
  });

  // Reuse the global accounts/movements/fx caches so totals stay consistent
  // with /treasury and /accounts.
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

  const balances = useMemo(
    () => computeBalanceMap(movementsQ.data ?? []),
    [movementsQ.data],
  );

  const fxMap = useMemo(
    () =>
      latestByKey(
        fxQ.data ?? [],
        (r) => r.currency_code.toUpperCase(),
        (r) => r.fetched_at,
      ),
    [fxQ.data],
  );
  const priceMap = useMemo(
    () =>
      latestByKey(
        pricesQ.data ?? [],
        (r) => r.asset_code,
        (r) => r.snapshot_date,
      ),
    [pricesQ.data],
  );

  const account = accountQ.data;
  const balance = balances.get(accountId) ?? 0;
  const usdValue = account
    ? usdValueFor(account, balance, fxMap, priceMap)
    : null;
  const stale = isFxStale(fxMap);
  const latestFxDate = latestFxFetchedAt(fxMap);

  // Build the unified timeline by walking movements ASC and accumulating.
  const ledgerRows = useMemo(() => {
    const data = ledgerQ.data;
    if (!data) return [];
    let running = 0;
    const ascRows = data.movements.map((m) => {
      const qty = Number(m.quantity);
      running += qty;
      const peer = m.group_id
        ? data.pairedPeers.get(m.group_id) ?? null
        : null;
      return { movement: m, peer, runningBalance: running };
    });
    // Show newest first. Running balance still reflects the as-of-row total.
    return ascRows.slice().reverse();
  }, [ledgerQ.data]);

  if (accountQ.isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (accountQ.isError || !account) {
    const errMsg =
      accountQ.error instanceof Error
        ? accountQ.error.message
        : accountQ.error
          ? String(accountQ.error)
          : "Unknown error";
    return (
      <div className="space-y-4">
        <BackLink />
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          {accountQ.isError
            ? `Failed to load account: ${errMsg}`
            : "This account does not exist."}
        </div>
      </div>
    );
  }

  const isDeleted = Boolean(account.deleted_at);
  const isActive = account.is_active !== false;
  const assetCode = account.asset_code ?? "";
  const txnPrefill: TransactionPrefill = {
    from_account_id: accountId,
    to_account_id: accountId,
  };

  return (
    <div className="space-y-6">
      <BackLink />

      <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            {assetCode ? (
              <Badge variant="outline" className="font-mono text-xs">
                {assetCode}
              </Badge>
            ) : null}
            {!isActive ? (
              <Badge
                variant="secondary"
                className="text-[10px] uppercase tracking-wide"
              >
                Inactive
              </Badge>
            ) : null}
            {isDeleted ? (
              <Badge
                variant="destructive"
                className="text-[10px] uppercase tracking-wide"
              >
                Deleted
              </Badge>
            ) : null}
          </div>
          <h1
            className={cn(
              "text-2xl font-semibold tracking-tight",
              isDeleted && "line-through",
            )}
          >
            {account.account_name}
          </h1>
          <p className="text-sm text-muted-foreground">
            {account.custody_locations?.name ?? "No custody"}
            {account.custody_locations?.location_type ? (
              <span className="text-muted-foreground/60">
                {" · "}
                {account.custody_locations.location_type}
              </span>
            ) : null}
            {account.bank_name ? (
              <span> · {account.bank_name}</span>
            ) : null}
          </p>
          {account.iban ? (
            <p className="font-mono text-xs text-muted-foreground">
              {formatIban(account.iban)}
            </p>
          ) : null}
        </div>

        {isDeleted ? null : (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setMoveOpen(true)}>
              <ArrowLeftRight className="mr-2 size-4" />
              Record movement
            </Button>
            <Button variant="outline" onClick={() => setTxnOpen(true)}>
              <Plus className="mr-2 size-4" />
              New transaction
            </Button>
            <Button variant="ghost" onClick={() => setEditOpen(true)}>
              <Pencil className="mr-2 size-4" />
              Edit
            </Button>
          </div>
        )}
      </header>

      {isDeleted ? (
        <div className="rounded-lg border border-dashed bg-muted/30 p-3 text-sm text-muted-foreground">
          This account is archived. Restore it from the Accounts list to make
          changes or record new activity.
        </div>
      ) : null}

      <section className="rounded-lg border bg-card p-5">
        <div className="flex flex-wrap items-baseline gap-4">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              USD value
            </div>
            <div
              className={cn(
                "text-3xl font-semibold tabular-nums tracking-tight",
                stale && "text-muted-foreground",
                usdValue === null && "text-muted-foreground",
              )}
              title={
                usdValue === null
                  ? "No price snapshot for this asset yet."
                  : stale
                    ? "FX rates are more than 24 hours old"
                    : undefined
              }
            >
              {formatUsd(usdValue)}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Quantity
            </div>
            <div className="text-xl font-medium tabular-nums">
              {formatQuantity(balance)}
              {assetCode ? (
                <span className="ml-1 text-sm text-muted-foreground">
                  {assetCode}
                </span>
              ) : null}
            </div>
          </div>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          USD view — rates from {formatDateShort(latestFxDate)}
          {stale ? " (stale)" : ""}
        </p>
      </section>

      <section className="space-y-2">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-medium">
            History
            <span className="ml-2 text-xs text-muted-foreground">
              {ledgerRows.length}{" "}
              {ledgerRows.length === 1 ? "entry" : "entries"}
            </span>
          </h2>
        </div>
        {ledgerQ.isLoading ? (
          <div className="space-y-2 rounded-lg border bg-card p-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : ledgerRows.length === 0 ? (
          <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
            No movements or transactions yet for this account.
          </div>
        ) : (
          <LedgerTable rows={ledgerRows} assetCode={assetCode} />
        )}
      </section>

      <AccountFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        accountId={accountId}
        existingNames={
          accountsQ.data?.map((a) => ({ id: a.id, name: a.account_name })) ?? []
        }
      />

      <RecordMovementDialog
        open={moveOpen}
        onOpenChange={(v) => {
          setMoveOpen(v);
          if (!v) setMoveDefaultKind(undefined);
        }}
        accounts={accountsQ.data ?? []}
        prefillAccountId={accountId}
        defaultKind={moveDefaultKind}
      />

      <TransactionFormDialog
        open={txnOpen}
        onOpenChange={setTxnOpen}
        accounts={accountsQ.data ?? []}
        prefill={txnPrefill}
        onMoveMoney={(kind) => {
          setMoveDefaultKind(kind);
          setMoveOpen(true);
        }}
      />
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/accounts"
      className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
    >
      ← Back to accounts
    </Link>
  );
}

type LedgerRow = {
  movement: LedgerMovement;
  peer: PairedLegPeer | null;
  runningBalance: number;
};

function LedgerTable({
  rows,
  assetCode,
}: {
  rows: LedgerRow[];
  assetCode: string;
}) {
  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[110px]">Date</TableHead>
            <TableHead className="w-[170px]">Kind</TableHead>
            <TableHead>Description</TableHead>
            <TableHead className="w-[160px] text-right">Amount</TableHead>
            <TableHead className="w-[160px] text-right">
              Running balance
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <LedgerRowView key={r.movement.id} row={r} assetCode={assetCode} />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function LedgerRowView({
  row,
  assetCode,
}: {
  row: LedgerRow;
  assetCode: string;
}) {
  const { movement, peer, runningBalance } = row;
  const qty = Number(movement.quantity);
  const isInflow = qty > 0;
  const isOutflow = qty < 0;
  const tx = movement.source_transaction;
  const isPaired = PAIRED_KINDS.includes(movement.kind as MovementKind);

  return (
    <TableRow>
      <TableCell className="text-sm text-muted-foreground">
        {formatDateShort(movement.movement_date)}
      </TableCell>
      <TableCell>
        {tx ? (
          <Badge
            variant="outline"
            className={cn(
              "font-normal",
              TRANSACTION_KIND_BADGE_CLASSES[tx.kind],
            )}
          >
            {TRANSACTION_KIND_LABELS[tx.kind]}
          </Badge>
        ) : (
          <Badge variant="secondary" className="font-normal">
            {MOVEMENT_KIND_LABELS[movement.kind as MovementKind] ??
              movement.kind}
          </Badge>
        )}
      </TableCell>
      <TableCell className="text-sm">
        <Description movement={movement} peer={peer} isPaired={isPaired} />
      </TableCell>
      <TableCell
        className={cn(
          "text-right font-mono text-sm tabular-nums",
          isInflow && "text-emerald-700",
          isOutflow && "text-rose-700",
        )}
      >
        {qty > 0 ? "+" : ""}
        {formatQuantity(qty)}
        {assetCode ? (
          <span className="ml-1 text-xs text-muted-foreground">
            {assetCode}
          </span>
        ) : null}
      </TableCell>
      <TableCell className="text-right font-mono text-sm tabular-nums text-muted-foreground">
        {formatQuantity(runningBalance)}
      </TableCell>
    </TableRow>
  );
}

function Description({
  movement,
  peer,
  isPaired,
}: {
  movement: LedgerMovement;
  peer: PairedLegPeer | null;
  isPaired: boolean;
}) {
  const tx = movement.source_transaction;
  const counterparty = tx
    ? tx.contact?.company_name ??
      tx.partner?.name ??
      tx.expense_type?.name ??
      null
    : null;

  if (isPaired && peer) {
    const peerName =
      peer.account?.account_name ??
      peer.account?.custody_locations?.name ??
      "Other account";
    const isOutflow = Number(movement.quantity) < 0;
    return (
      <span className="inline-flex items-center gap-1.5">
        {isOutflow ? (
          <>
            <ArrowUpRight className="size-3.5 text-muted-foreground" />
            <span>To {peerName}</span>
          </>
        ) : (
          <>
            <ArrowRight className="size-3.5 text-muted-foreground rotate-180" />
            <span>From {peerName}</span>
          </>
        )}
        {movement.notes ? (
          <span className="text-muted-foreground"> · {movement.notes}</span>
        ) : null}
      </span>
    );
  }

  if (tx) {
    return (
      <span className="inline-flex flex-wrap items-baseline gap-1.5">
        {counterparty ? <span>{counterparty}</span> : null}
        {tx.reference_number ? (
          <span className="font-mono text-xs text-muted-foreground">
            #{tx.reference_number}
          </span>
        ) : null}
        {tx.description ? (
          <span className="text-muted-foreground"> · {tx.description}</span>
        ) : null}
      </span>
    );
  }

  return movement.notes ? (
    <span>{movement.notes}</span>
  ) : (
    <span className="text-muted-foreground">—</span>
  );
}

function formatIban(iban: string): string {
  const stripped = iban.replace(/\s+/g, "");
  return stripped.match(/.{1,4}/g)?.join(" ") ?? iban;
}
