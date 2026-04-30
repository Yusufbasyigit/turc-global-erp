"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Pencil, Archive, Undo2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { CustodyLocation } from "@/lib/supabase/types";

import { listCustodyLocations, settingsKeys, treasuryKeys } from "./queries";
import { setCustodyLocationActive } from "./mutations";
import { CustodyLocationFormDialog } from "./custody-location-form-dialog";

export function CustodyLocationsSection() {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CustodyLocation | null>(null);

  const listQ = useQuery({
    queryKey: treasuryKeys.custody(),
    queryFn: () => listCustodyLocations({ activeOnly: false }),
  });

  const archiveMut = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      setCustodyLocationActive(id, active),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: settingsKeys.all });
      qc.invalidateQueries({ queryKey: treasuryKeys.custody() });
      toast.success(vars.active ? "Restored" : "Archived");
    },
    onError: (e: Error) => toast.error(e.message ?? "Failed to update"),
  });

  const openAdd = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (loc: CustodyLocation) => {
    setEditing(loc);
    setDialogOpen(true);
  };

  const items = listQ.data ?? [];

  return (
    <section className="space-y-4">
      <header className="flex items-end justify-between gap-4">
        <div className="space-y-1">
          <h2 className="editorial-h2">Custody locations</h2>
          <p className="text-sm text-muted-foreground">
            Where accounts live — banks, safes, partner pockets. Picked when
            you create or edit an account.
          </p>
        </div>
        <Button onClick={openAdd}>
          <Plus className="mr-2 size-4" />
          Add location
        </Button>
      </header>

      <div className="rounded-md border bg-card">
        {listQ.isLoading ? (
          <div className="space-y-2 p-4">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        ) : listQ.error ? (
          <p className="p-4 text-sm text-destructive">
            Failed to load locations: {(listQ.error as Error).message}
          </p>
        ) : items.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">
            No custody locations yet. Add one to start creating accounts.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Movement type required</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((loc) => {
                const active = loc.is_active !== false;
                return (
                  <TableRow
                    key={loc.id}
                    className={cn(!active && "opacity-60")}
                  >
                    <TableCell className="font-medium">{loc.name}</TableCell>
                    <TableCell className="capitalize">
                      {loc.location_type}
                    </TableCell>
                    <TableCell>
                      {loc.requires_movement_type ? "Yes" : "No"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={active ? "default" : "secondary"}>
                        {active ? "Active" : "Archived"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEdit(loc)}
                        >
                          <Pencil className="size-4" />
                          <span className="sr-only">Edit</span>
                        </Button>
                        {active ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={archiveMut.isPending}
                            onClick={() =>
                              archiveMut.mutate({
                                id: loc.id,
                                active: false,
                              })
                            }
                          >
                            <Archive className="size-4" />
                            <span className="sr-only">Archive</span>
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={archiveMut.isPending}
                            onClick={() =>
                              archiveMut.mutate({
                                id: loc.id,
                                active: true,
                              })
                            }
                          >
                            <Undo2 className="size-4" />
                            <span className="sr-only">Restore</span>
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <CustodyLocationFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        existing={editing}
      />
    </section>
  );
}
