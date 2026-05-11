"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

export function ContactsTable({
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
  const router = useRouter();
  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[180px]">Roles</TableHead>
            <TableHead>Company</TableHead>
            <TableHead>Contact</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Country</TableHead>
            <TableHead>Currency</TableHead>
            <TableHead className="text-right">Balance</TableHead>
            <TableHead className="w-[48px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {contacts.map((c) => (
            <TableRow
              key={c.id}
              className="cursor-pointer hover:bg-muted/30"
              onClick={(e) => {
                if (e.button !== 0) return;
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                const t = e.target as HTMLElement;
                if (t.closest("[data-row-action]")) return;
                if (t.closest("a")) return;
                router.push(`/contacts/${c.id}`);
              }}
            >
              <TableCell>
                <ContactRoleBadges contact={c} />
              </TableCell>
              <TableCell className="font-medium">
                <Link
                  href={`/contacts/${c.id}`}
                  className="hover:underline"
                >
                  {c.company_name}
                </Link>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {c.contact_person || "—"}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {c.phone || "—"}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {c.email || "—"}
              </TableCell>
              <TableCell>
                <CountryFlag country={c.countries} />
              </TableCell>
              <TableCell className="text-muted-foreground font-mono text-xs">
                {c.balance_currency || "—"}
              </TableCell>
              <TableCell className="text-right font-mono text-xs">
                <BalanceCell balance={balances.get(c.id)} />
              </TableCell>
              <TableCell data-row-action>
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
                  <DropdownMenuContent
                    align="end"
                    onClick={(e) => e.stopPropagation()}
                  >
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
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
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
