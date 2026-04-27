"use client";

import Link from "next/link";
import {
  MoreHorizontal,
  Pencil,
  Power,
  PowerOff,
  Trash2,
  Undo2,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { AccountWithCustody } from "@/lib/supabase/types";
import { formatQuantity } from "@/features/treasury/fx-utils";

export type AccountGroup = {
  id: string;
  label: string;
  rows: AccountWithCustody[];
};

export function AccountsTable({
  groups,
  balances,
  onEdit,
  onToggleActive,
  onDelete,
  onRestore,
}: {
  groups: AccountGroup[];
  balances: Map<string, number>;
  onEdit: (id: string) => void;
  onToggleActive: (account: AccountWithCustody, nextActive: boolean) => void;
  onDelete: (account: AccountWithCustody) => void;
  onRestore: (id: string) => void;
}) {
  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead className="w-[90px]">Asset</TableHead>
            <TableHead className="w-[200px]">Custody</TableHead>
            <TableHead className="w-[220px]">Bank / IBAN</TableHead>
            <TableHead className="w-[120px]">Subtype</TableHead>
            <TableHead className="w-[140px] text-right">Balance</TableHead>
            <TableHead className="w-[120px]">Status</TableHead>
            <TableHead className="w-[48px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {groups.map((g) => (
            <GroupSection
              key={g.id}
              group={g}
              balances={balances}
              onEdit={onEdit}
              onToggleActive={onToggleActive}
              onDelete={onDelete}
              onRestore={onRestore}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function GroupSection({
  group,
  balances,
  onEdit,
  onToggleActive,
  onDelete,
  onRestore,
}: {
  group: AccountGroup;
  balances: Map<string, number>;
  onEdit: (id: string) => void;
  onToggleActive: (account: AccountWithCustody, nextActive: boolean) => void;
  onDelete: (account: AccountWithCustody) => void;
  onRestore: (id: string) => void;
}) {
  const activeCount = group.rows.filter(
    (a) => a.is_active !== false && !a.deleted_at,
  ).length;
  return (
    <>
      <TableRow className="bg-muted/40 hover:bg-muted/40">
        <TableCell
          colSpan={8}
          className="py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground"
        >
          {group.label}
          <span className="ml-2 text-muted-foreground/60">
            {activeCount} active
            {group.rows.length !== activeCount
              ? ` · ${group.rows.length} total`
              : ""}
          </span>
        </TableCell>
      </TableRow>
      {group.rows.map((a) => (
        <AccountRow
          key={a.id}
          account={a}
          balance={balances.get(a.id) ?? 0}
          onEdit={onEdit}
          onToggleActive={onToggleActive}
          onDelete={onDelete}
          onRestore={onRestore}
        />
      ))}
    </>
  );
}

function AccountRow({
  account,
  balance,
  onEdit,
  onToggleActive,
  onDelete,
  onRestore,
}: {
  account: AccountWithCustody;
  balance: number;
  onEdit: (id: string) => void;
  onToggleActive: (account: AccountWithCustody, nextActive: boolean) => void;
  onDelete: (account: AccountWithCustody) => void;
  onRestore: (id: string) => void;
}) {
  const isDeleted = Boolean(account.deleted_at);
  const isActive = account.is_active !== false;
  const dimClass = isDeleted ? "opacity-40" : !isActive ? "opacity-60" : "";

  const custody = account.custody_locations;
  const isFiat = account.asset_type === "fiat";

  return (
    <TableRow className={cn(dimClass)}>
      <TableCell className="font-medium">
        <Link
          href={`/accounts/${account.id}`}
          className={cn(
            "text-left hover:underline",
            isDeleted && "line-through",
          )}
        >
          {account.account_name}
        </Link>
      </TableCell>
      <TableCell>
        {account.asset_code ? (
          <Badge variant="outline" className="font-mono text-xs">
            {account.asset_code}
          </Badge>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="text-sm">
        {custody ? (
          <div className="flex flex-col">
            <span>{custody.name}</span>
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {custody.location_type}
            </span>
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="text-sm">
        {isFiat && (account.bank_name || account.iban) ? (
          <div className="flex flex-col">
            {account.bank_name ? (
              <span>{account.bank_name}</span>
            ) : null}
            {account.iban ? (
              <span className="font-mono text-[11px] text-muted-foreground">
                {formatIban(account.iban)}
              </span>
            ) : null}
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="text-sm">
        {account.subtype ? (
          account.subtype
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="text-right font-mono text-sm">
        {formatQuantity(balance)}
      </TableCell>
      <TableCell>
        <StatusPills isDeleted={isDeleted} isActive={isActive} />
      </TableCell>
      <TableCell>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              aria-label="Row actions"
            >
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {isDeleted ? (
              <DropdownMenuItem onSelect={() => onRestore(account.id)}>
                <Undo2 className="mr-2 size-4" />
                Restore
              </DropdownMenuItem>
            ) : (
              <>
                <DropdownMenuItem onSelect={() => onEdit(account.id)}>
                  <Pencil className="mr-2 size-4" />
                  Edit
                </DropdownMenuItem>
                {isActive ? (
                  <DropdownMenuItem
                    onSelect={() => onToggleActive(account, false)}
                  >
                    <PowerOff className="mr-2 size-4" />
                    Deactivate
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    onSelect={() => onToggleActive(account, true)}
                  >
                    <Power className="mr-2 size-4" />
                    Reactivate
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onSelect={() => onDelete(account)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 size-4" />
                  Delete
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}

function StatusPills({
  isDeleted,
  isActive,
}: {
  isDeleted: boolean;
  isActive: boolean;
}) {
  // Spec: Active gets no pill (default state). Stack pills if both flags
  // negative.
  const pills: React.ReactNode[] = [];
  if (!isActive) {
    pills.push(
      <Badge
        key="inactive"
        variant="secondary"
        className="text-[10px] uppercase tracking-wide"
      >
        Inactive
      </Badge>,
    );
  }
  if (isDeleted) {
    pills.push(
      <Badge
        key="deleted"
        variant="destructive"
        className="text-[10px] uppercase tracking-wide"
      >
        Deleted
      </Badge>,
    );
  }
  if (pills.length === 0) return null;
  return <div className="flex flex-wrap gap-1">{pills}</div>;
}

function formatIban(iban: string): string {
  // Group every 4 chars for readability.
  const stripped = iban.replace(/\s+/g, "");
  return stripped.match(/.{1,4}/g)?.join(" ") ?? iban;
}
