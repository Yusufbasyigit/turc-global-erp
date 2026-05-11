"use client";

import { RotateCcw } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import type { ContactWithCountry } from "@/lib/supabase/types";
import { ContactRoleBadges } from "./role-badges";
import { CountryFlag } from "./country-flag";

function formatDeletedAt(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ArchivedContactsTable({
  contacts,
  onRestore,
}: {
  contacts: ContactWithCountry[];
  onRestore: (id: string, name: string) => void;
}) {
  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[180px]">Roles</TableHead>
            <TableHead>Company</TableHead>
            <TableHead>Contact</TableHead>
            <TableHead>Country</TableHead>
            <TableHead>Deleted</TableHead>
            <TableHead className="w-[120px] text-right" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {contacts.map((c) => (
            <TableRow key={c.id} className="hover:bg-muted/30">
              <TableCell>
                <ContactRoleBadges contact={c} />
              </TableCell>
              <TableCell className="font-medium text-muted-foreground">
                {c.company_name}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {c.contact_person ?? "—"}
              </TableCell>
              <TableCell>
                <CountryFlag country={c.countries} />
              </TableCell>
              <TableCell className="text-muted-foreground text-xs">
                {formatDeletedAt(c.deleted_at)}
              </TableCell>
              <TableCell className="text-right">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onRestore(c.id, c.company_name)}
                >
                  <RotateCcw className="mr-2 size-3.5" />
                  Restore
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
