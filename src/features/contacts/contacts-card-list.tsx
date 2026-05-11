"use client";

import Link from "next/link";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ContactWithCountry } from "@/lib/supabase/types";
import { formatCurrency } from "@/lib/format-money";
import { cn } from "@/lib/utils";
import { ContactRoleBadges } from "./role-badges";
import { CountryFlag } from "./country-flag";
import type { ContactBalance } from "./queries";

export function ContactsCardList({
  contacts,
  balances,
  onEdit,
  onDelete,
}: {
  contacts: ContactWithCountry[];
  balances: Map<string, ContactBalance>;
  onEdit: (id: string) => void;
  onDelete: (id: string, name: string) => void;
}) {
  return (
    <div className="space-y-3">
      {contacts.map((c) => (
        <Card key={c.id}>
          <CardHeader className="flex-row items-start justify-between gap-2 pb-2">
            <div className="min-w-0 space-y-1">
              <ContactRoleBadges contact={c} />
              <CardTitle className="truncate text-base">
                <Link href={`/contacts/${c.id}`} className="hover:underline">
                  {c.company_name}
                </Link>
              </CardTitle>
              {c.contact_person ? (
                <p className="truncate text-sm text-muted-foreground">
                  {c.contact_person}
                </p>
              ) : null}
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
                <DropdownMenuItem onSelect={() => onEdit(c.id)}>
                  <Pencil className="mr-2 size-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => onDelete(c.id, c.company_name)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 size-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </CardHeader>
          <CardContent className="pb-4 pt-0 text-sm">
            <dl className="grid grid-cols-2 gap-y-1 text-xs">
              {c.phone ? (
                <>
                  <dt className="text-muted-foreground">Phone</dt>
                  <dd className="text-right">{c.phone}</dd>
                </>
              ) : null}
              {c.email ? (
                <>
                  <dt className="text-muted-foreground">Email</dt>
                  <dd className="truncate text-right">{c.email}</dd>
                </>
              ) : null}
              <dt className="text-muted-foreground">Country</dt>
              <dd className="flex justify-end">
                <CountryFlag country={c.countries} />
              </dd>
              <dt className="text-muted-foreground">Balance</dt>
              <dd className="text-right font-mono">
                <BalanceCell balance={balances.get(c.id)} />
              </dd>
            </dl>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function BalanceCell({ balance }: { balance: ContactBalance | undefined }) {
  if (!balance || !balance.has_transactions) {
    return <span className="text-muted-foreground">—</span>;
  }
  const isZero = Math.abs(balance.net_balance) < 0.005;
  return (
    <span
      className={cn(
        "tabular-nums",
        isZero
          ? "text-muted-foreground"
          : balance.net_balance > 0
            ? "text-rose-700"
            : "text-emerald-700",
      )}
      title={
        balance.has_skipped
          ? "Some transactions in another currency are excluded from this total."
          : undefined
      }
    >
      {formatCurrency(balance.net_balance, balance.currency)}
      {balance.has_skipped ? <span className="ml-1 text-amber-700">*</span> : null}
    </span>
  );
}
