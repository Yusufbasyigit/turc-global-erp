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
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import type { AccountGroup } from "./accounts-table";

export function AccountsCardList({
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
    <div className="space-y-4">
      {groups.map((g) => (
        <section key={g.id} className="space-y-2">
          <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {g.label}
          </h3>
          {g.rows.map((a) => (
            <AccountCard
              key={a.id}
              account={a}
              balance={balances.get(a.id) ?? 0}
              onEdit={onEdit}
              onToggleActive={onToggleActive}
              onDelete={onDelete}
              onRestore={onRestore}
            />
          ))}
        </section>
      ))}
    </div>
  );
}

function AccountCard({
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

  return (
    <Card className={cn(dimClass)}>
      <CardHeader className="flex-row items-start justify-between gap-2 pb-2">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap gap-1">
            {account.asset_code ? (
              <Badge variant="outline" className="font-mono text-[10px]">
                {account.asset_code}
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
          <CardTitle
            className={cn(
              "truncate text-base",
              isDeleted && "line-through",
            )}
          >
            <Link
              href={`/accounts/${account.id}`}
              className="text-left hover:underline"
            >
              {account.account_name}
            </Link>
          </CardTitle>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              aria-label="Actions"
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
      </CardHeader>
      <CardContent className="pb-4 pt-0 text-sm">
        <dl className="grid grid-cols-2 gap-y-1 text-xs">
          <dt className="text-muted-foreground">Custody</dt>
          <dd className="text-right">
            {custody ? custody.name : "—"}
          </dd>
          {account.bank_name || account.iban ? (
            <>
              <dt className="text-muted-foreground">Bank</dt>
              <dd className="text-right">
                {account.bank_name ?? "—"}
              </dd>
              {account.iban ? (
                <>
                  <dt className="text-muted-foreground">IBAN</dt>
                  <dd className="text-right font-mono text-[11px]">
                    {account.iban}
                  </dd>
                </>
              ) : null}
            </>
          ) : null}
          {account.subtype ? (
            <>
              <dt className="text-muted-foreground">Subtype</dt>
              <dd className="text-right">{account.subtype}</dd>
            </>
          ) : null}
          <dt className="text-muted-foreground">Balance</dt>
          <dd className="text-right font-mono">
            {formatQuantity(balance)}
          </dd>
        </dl>
      </CardContent>
    </Card>
  );
}
