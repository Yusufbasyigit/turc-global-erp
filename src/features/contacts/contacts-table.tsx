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
import { ContactTypeBadge } from "./type-badge";
import { CountryFlag } from "./country-flag";

export function ContactsTable({
  contacts,
  onEdit,
  onDelete,
}: {
  contacts: ContactWithCountry[];
  onEdit: (id: string) => void;
  onDelete: (id: string, name: string) => void;
}) {
  const router = useRouter();
  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[110px]">Type</TableHead>
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
                if ((e.target as HTMLElement).closest("[data-row-action]")) return;
                router.push(`/contacts/${c.id}`);
              }}
            >
              <TableCell>
                <ContactTypeBadge type={c.type} />
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
                {c.contact_person ?? "—"}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {c.phone ?? "—"}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {c.email ?? "—"}
              </TableCell>
              <TableCell>
                <CountryFlag country={c.countries} />
              </TableCell>
              <TableCell className="text-muted-foreground font-mono text-xs">
                {c.balance_currency ?? "—"}
              </TableCell>
              <TableCell className="text-right text-muted-foreground font-mono text-xs">
                {/* TODO: wire to transactions module for running client balance */}
                —
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
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
