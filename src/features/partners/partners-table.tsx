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
import { formatDateOnly } from "@/lib/format-date";
import type { PartnerWithStats } from "./queries";

export function PartnersTable({
  partners,
  onRename,
  onToggleActive,
  onDelete,
  onRestore,
}: {
  partners: PartnerWithStats[];
  onRename: (id: string) => void;
  onToggleActive: (id: string, nextActive: boolean) => void;
  onDelete: (partner: PartnerWithStats) => void;
  onRestore: (id: string) => void;
}) {
  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead className="w-[120px]">Status</TableHead>
            <TableHead className="w-[120px] text-right">Transactions</TableHead>
            <TableHead className="w-[160px]">Last activity</TableHead>
            <TableHead className="w-[48px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {partners.map((p) => {
            const isDeleted = p.deleted_at !== null;
            const dimClass = isDeleted
              ? "opacity-40"
              : !p.is_active
                ? "opacity-60"
                : "";
            return (
              <TableRow key={p.id} className={cn(dimClass)}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    {isDeleted ? (
                      <span>{p.name}</span>
                    ) : (
                      <Link
                        href={`/partners/${p.id}`}
                        className="hover:underline"
                      >
                        {p.name}
                      </Link>
                    )}
                    {isDeleted ? (
                      <Badge
                        variant="destructive"
                        className="text-[10px] uppercase tracking-wide"
                      >
                        Deleted
                      </Badge>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell>
                  <StatusBadge
                    isDeleted={isDeleted}
                    isActive={p.is_active}
                  />
                </TableCell>
                <TableCell className="text-right font-mono text-xs">
                  {p.transaction_count}
                </TableCell>
                <TableCell className="text-muted-foreground text-xs">
                  {formatDate(p.last_activity)}
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
                        <DropdownMenuItem onSelect={() => onRestore(p.id)}>
                          <Undo2 className="mr-2 size-4" />
                          Restore
                        </DropdownMenuItem>
                      ) : (
                        <>
                          <DropdownMenuItem onSelect={() => onRename(p.id)}>
                            <Pencil className="mr-2 size-4" />
                            Rename
                          </DropdownMenuItem>
                          {p.is_active ? (
                            <DropdownMenuItem
                              onSelect={() => onToggleActive(p.id, false)}
                            >
                              <PowerOff className="mr-2 size-4" />
                              Deactivate
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              onSelect={() => onToggleActive(p.id, true)}
                            >
                              <Power className="mr-2 size-4" />
                              Reactivate
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            onSelect={() => onDelete(p)}
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
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function StatusBadge({
  isDeleted,
  isActive,
}: {
  isDeleted: boolean;
  isActive: boolean;
}) {
  if (isDeleted) return <Badge variant="destructive">Deleted</Badge>;
  if (isActive)
    return (
      <Badge className="bg-emerald-500/15 text-emerald-700 border-transparent">
        Active
      </Badge>
    );
  return <Badge variant="secondary">Inactive</Badge>;
}

function formatDate(dateStr: string | null): string {
  return formatDateOnly(dateStr);
}
