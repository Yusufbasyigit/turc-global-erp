"use client";

import { useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import {
  ASSET_TYPES,
  type AccountWithCustody,
  type AssetType,
} from "@/lib/supabase/types";
import {
  computeBalanceMap,
  listAllMovements,
  listCustodyLocations,
  treasuryKeys,
} from "@/features/treasury/queries";
import { ASSET_TYPE_LABELS } from "@/features/treasury/constants";

import { accountKeys, listAccountsForRegistry } from "./queries";
import { restoreAccount } from "./mutations";
import { AccountFormDialog } from "./account-form-dialog";
import { DeactivateAccountDialog } from "./deactivate-account-dialog";
import { DeleteAccountDialog } from "./delete-account-dialog";
import {
  AccountsTable,
  type AccountGroup,
} from "./accounts-table";
import { AccountsCardList } from "./accounts-card-list";

type Grouping = "asset_type" | "custody_location" | "flat";

// Section order for asset_type grouping per spec: Fiat → Credit cards → Funds → Crypto → Metals.
const ASSET_TYPE_ORDER: AssetType[] = [
  "fiat",
  "credit_card",
  "fund",
  "crypto",
  "metal",
];

export function AccountsIndex() {
  const isMobile = useIsMobile();
  const qc = useQueryClient();

  const [grouping, setGrouping] = useState<Grouping>("asset_type");
  const [custodyFilter, setCustodyFilter] = useState<string[]>([]);
  const [showInactive, setShowInactive] = useState(false);
  const [showDeleted, setShowDeleted] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [deactivateTarget, setDeactivateTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
    movementCount: number;
  } | null>(null);

  const accountsQ = useQuery({
    queryKey: accountKeys.list(),
    queryFn: listAccountsForRegistry,
  });

  // Movements: same key as /treasury so the cache dedupes cross-page.
  const movementsQ = useQuery({
    queryKey: treasuryKeys.movements(),
    queryFn: listAllMovements,
  });

  const custodyQ = useQuery({
    queryKey: treasuryKeys.custody(),
    queryFn: () => listCustodyLocations({ activeOnly: false }),
  });

  const balances = useMemo(
    () => computeBalanceMap(movementsQ.data ?? []),
    [movementsQ.data],
  );

  const movementCountByAccount = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of movementsQ.data ?? []) {
      map.set(m.account_id, (map.get(m.account_id) ?? 0) + 1);
    }
    return map;
  }, [movementsQ.data]);

  const accounts = useMemo(
    () => accountsQ.data ?? [],
    [accountsQ.data],
  );

  const inactiveCount = useMemo(
    () =>
      accounts.filter(
        (a) => a.is_active === false && !a.deleted_at,
      ).length,
    [accounts],
  );
  const deletedCount = useMemo(
    () => accounts.filter((a) => Boolean(a.deleted_at)).length,
    [accounts],
  );

  // Active custody locations only (filter chips). Sorted alphabetically.
  const custodyChips = useMemo(
    () =>
      (custodyQ.data ?? [])
        .filter((c) => c.is_active !== false)
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name)),
    [custodyQ.data],
  );

  // Existing names (excluding deleted) for the form's uniqueness check.
  const existingNames = useMemo(
    () =>
      accounts
        .filter((a) => !a.deleted_at)
        .map((a) => ({ id: a.id, name: a.account_name })),
    [accounts],
  );

  // Filter pipeline: drop deleted unless toggled, drop inactive unless toggled,
  // narrow by chip filter. is_active is NOT NULL DEFAULT true, but pre-migration
  // the column may be undefined — treat that as active.
  const filtered = useMemo(() => {
    return accounts.filter((a) => {
      const deleted = Boolean(a.deleted_at);
      if (deleted && !showDeleted) return false;
      if (!deleted && a.is_active === false && !showInactive) return false;
      if (
        custodyFilter.length > 0 &&
        (!a.custody_location_id ||
          !custodyFilter.includes(a.custody_location_id))
      ) {
        return false;
      }
      return true;
    });
  }, [accounts, showDeleted, showInactive, custodyFilter]);

  const groups = useMemo<AccountGroup[]>(
    () => buildGroups(filtered, grouping),
    [filtered, grouping],
  );

  // Restore is one-click (no dialog) — same as partners.
  const restoreMut = useMutation({
    mutationFn: (id: string) => restoreAccount(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: accountKeys.all });
      qc.invalidateQueries({ queryKey: treasuryKeys.accounts() });
      qc.invalidateQueries({ queryKey: treasuryKeys.all });
      toast.success("Account restored");
    },
    onError: (e: Error) => toast.error(e.message ?? "Failed to restore"),
  });

  const reactivateMut = useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const { setAccountActive } = await import("./mutations");
      return setAccountActive(id, true);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: accountKeys.all });
      qc.invalidateQueries({ queryKey: treasuryKeys.accounts() });
      qc.invalidateQueries({ queryKey: treasuryKeys.all });
      toast.success("Account reactivated");
    },
    onError: (e: Error) => toast.error(e.message ?? "Failed to reactivate"),
  });

  const openCreate = () => {
    setEditingId(null);
    setFormOpen(true);
  };
  const openEdit = (id: string) => {
    setEditingId(id);
    setFormOpen(true);
  };

  const handleToggleActive = (
    account: AccountWithCustody,
    nextActive: boolean,
  ) => {
    if (nextActive) {
      reactivateMut.mutate({ id: account.id });
    } else {
      setDeactivateTarget({ id: account.id, name: account.account_name });
    }
  };

  const handleDelete = (account: AccountWithCustody) => {
    if (!movementsQ.isSuccess) {
      // Without the movement count we can't render a truthful confirmation
      // copy ("X has N movements …"), so wait for the query rather than show
      // a stale "0 movements" claim.
      toast.message("Loading movement count — try again in a moment.");
      return;
    }
    setDeleteTarget({
      id: account.id,
      name: account.account_name,
      movementCount: movementCountByAccount.get(account.id) ?? 0,
    });
  };

  const toggleCustodyChip = (id: string) => {
    setCustodyFilter((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const isLoading = accountsQ.isLoading;
  const isError = accountsQ.isError;
  const errorMsg = (accountsQ.error as Error | null)?.message;

  const hasGroups = groups.some((g) => g.rows.length > 0);

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Accounts</h1>
          <p className="text-sm text-muted-foreground">
            Holdings — what asset, where it&apos;s custodied.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 size-4" />
          Add account
        </Button>
      </header>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-3">
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Group by</span>
          <Select
            value={grouping}
            onValueChange={(v) => setGrouping(v as Grouping)}
          >
            <SelectTrigger className="h-9 w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="asset_type">Asset type</SelectItem>
              <SelectItem value="custody_location">
                Custody location
              </SelectItem>
              <SelectItem value="flat">Flat list</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-xs text-muted-foreground">Custody</span>
          <CustodyChipFilter
            chips={custodyChips}
            selected={custodyFilter}
            onToggle={toggleCustodyChip}
            onClear={() => setCustodyFilter([])}
            isLoading={custodyQ.isLoading}
          />
        </div>

        <div className="flex items-center gap-2">
          {inactiveCount > 0 ? (
            <Button
              variant={showInactive ? "default" : "outline"}
              size="sm"
              onClick={() => setShowInactive((v) => !v)}
            >
              {showInactive
                ? `Hide inactive (${inactiveCount})`
                : `Show inactive (${inactiveCount})`}
            </Button>
          ) : null}
          {deletedCount > 0 ? (
            <Button
              variant={showDeleted ? "default" : "outline"}
              size="sm"
              onClick={() => setShowDeleted((v) => !v)}
            >
              {showDeleted
                ? `Hide deleted (${deletedCount})`
                : `Show deleted (${deletedCount})`}
            </Button>
          ) : null}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2 rounded-lg border bg-card p-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : null}

      {isError ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          Failed to load accounts: {errorMsg}
        </div>
      ) : null}

      {!isLoading && !isError && !hasGroups ? (
        <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
          {accounts.length === 0
            ? "No accounts yet — add one to get started."
            : "No accounts match the current filters."}
        </div>
      ) : null}

      {!isLoading && hasGroups ? (
        isMobile ? (
          <AccountsCardList
            groups={groups}
            balances={balances}
            onEdit={openEdit}
            onToggleActive={handleToggleActive}
            onDelete={handleDelete}
            onRestore={(id) => restoreMut.mutate(id)}
          />
        ) : (
          <AccountsTable
            groups={groups}
            balances={balances}
            onEdit={openEdit}
            onToggleActive={handleToggleActive}
            onDelete={handleDelete}
            onRestore={(id) => restoreMut.mutate(id)}
          />
        )
      ) : null}

      <AccountFormDialog
        open={formOpen}
        onOpenChange={(o) => {
          setFormOpen(o);
          if (!o) setEditingId(null);
        }}
        accountId={editingId}
        existingNames={existingNames}
      />

      {deactivateTarget ? (
        <DeactivateAccountDialog
          accountId={deactivateTarget.id}
          accountName={deactivateTarget.name}
          open={Boolean(deactivateTarget)}
          onOpenChange={(o) => {
            if (!o) setDeactivateTarget(null);
          }}
        />
      ) : null}

      {deleteTarget ? (
        <DeleteAccountDialog
          accountId={deleteTarget.id}
          accountName={deleteTarget.name}
          movementCount={deleteTarget.movementCount}
          open={Boolean(deleteTarget)}
          onOpenChange={(o) => {
            if (!o) setDeleteTarget(null);
          }}
        />
      ) : null}
    </div>
  );
}

function CustodyChipFilter({
  chips,
  selected,
  onToggle,
  onClear,
  isLoading,
}: {
  chips: { id: string; name: string }[];
  selected: string[];
  onToggle: (id: string) => void;
  onClear: () => void;
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="flex gap-1">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-20" />
        ))}
      </div>
    );
  }
  if (chips.length === 0) {
    return (
      <span className="text-xs text-muted-foreground">
        No custody locations.
      </span>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {chips.map((c) => {
        const active = selected.includes(c.id);
        return (
          <Button
            key={c.id}
            type="button"
            size="sm"
            variant={active ? "default" : "outline"}
            onClick={() => onToggle(c.id)}
            className="h-8"
          >
            {c.name}
          </Button>
        );
      })}
      {selected.length > 0 ? (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={onClear}
          className={cn("h-8 text-muted-foreground")}
        >
          <X className="mr-1 size-3" />
          Clear
        </Button>
      ) : null}
    </div>
  );
}

function buildGroups(
  rows: AccountWithCustody[],
  grouping: Grouping,
): AccountGroup[] {
  if (grouping === "flat") {
    if (rows.length === 0) return [];
    return [
      {
        id: "all",
        label: "All accounts",
        rows: rows.slice().sort(byName),
      },
    ];
  }

  if (grouping === "custody_location") {
    const byLoc = new Map<string, AccountGroup>();
    for (const a of rows) {
      const key = a.custody_locations?.id ?? "_none";
      const label = a.custody_locations?.name ?? "No custody";
      if (!byLoc.has(key)) {
        byLoc.set(key, { id: key, label, rows: [] });
      }
      byLoc.get(key)!.rows.push(a);
    }
    return Array.from(byLoc.values())
      .map((g) => ({ ...g, rows: g.rows.slice().sort(byName) }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  // asset_type — explicit Fiat → Credit cards → Fund → Crypto → Metal order
  // (matches ASSET_TYPE_ORDER above), then "Unclassified" for NULL asset_type.
  const buckets = new Map<string, AccountWithCustody[]>();
  for (const a of rows) {
    const key = a.asset_type ?? "_unknown";
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(a);
  }

  const ordered: AccountGroup[] = [];
  for (const t of ASSET_TYPE_ORDER) {
    const list = buckets.get(t);
    if (list && list.length > 0) {
      ordered.push({
        id: t,
        label: ASSET_TYPE_LABELS[t],
        rows: list.slice().sort(byName),
      });
    }
  }
  // Any unrecognized asset_type values (or NULL) at the end.
  for (const [key, list] of buckets) {
    if (ASSET_TYPES.includes(key as AssetType)) continue;
    ordered.push({
      id: key,
      label: "Unclassified",
      rows: list.slice().sort(byName),
    });
  }
  return ordered;
}

function byName(a: AccountWithCustody, b: AccountWithCustody): number {
  return a.account_name.localeCompare(b.account_name);
}
