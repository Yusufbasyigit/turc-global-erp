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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

export function PartnersCardList({
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
    <div className="space-y-3">
      {partners.map((p) => {
        const isDeleted = p.deleted_at !== null;
        const dimClass = isDeleted
          ? "opacity-40"
          : !p.is_active
            ? "opacity-60"
            : "";
        return (
          <Card key={p.id} className={cn(dimClass)}>
            <CardHeader className="flex-row items-start justify-between gap-2 pb-2">
              <div className="min-w-0 space-y-1">
                <StatusBadge isDeleted={isDeleted} isActive={p.is_active} />
                <CardTitle className="truncate text-base">
                  {isDeleted ? (
                    p.name
                  ) : (
                    <Link
                      href={`/partners/${p.id}`}
                      className="hover:underline"
                    >
                      {p.name}
                    </Link>
                  )}
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
            </CardHeader>
            <CardContent className="pb-4 pt-0 text-sm">
              <dl className="grid grid-cols-2 gap-y-1 text-xs">
                <dt className="text-muted-foreground">Transactions</dt>
                <dd className="text-right font-mono">{p.transaction_count}</dd>
                <dt className="text-muted-foreground">Last activity</dt>
                <dd className="text-right">{formatDate(p.last_activity)}</dd>
              </dl>
            </CardContent>
          </Card>
        );
      })}
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
