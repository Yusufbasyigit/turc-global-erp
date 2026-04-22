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
import { ContactTypeBadge } from "./type-badge";
import { CountryFlag } from "./country-flag";

export function ContactsCardList({
  contacts,
  onEdit,
  onDelete,
}: {
  contacts: ContactWithCountry[];
  onEdit: (id: string) => void;
  onDelete: (id: string, name: string) => void;
}) {
  return (
    <div className="space-y-3">
      {contacts.map((c) => (
        <Card key={c.id}>
          <CardHeader className="flex-row items-start justify-between gap-2 pb-2">
            <div className="min-w-0 space-y-1">
              <ContactTypeBadge type={c.type} />
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
                {/* TODO: wire to transactions module */}
                {c.balance_currency ? `${c.balance_currency} ` : ""}—
              </dd>
            </dl>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
