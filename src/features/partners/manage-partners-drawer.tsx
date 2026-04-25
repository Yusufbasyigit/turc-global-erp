"use client";

import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { transactionKeys } from "@/features/transactions/queries";
import {
  listPartnersWithStats,
  partnerKeys,
  type PartnerWithStats,
} from "./queries";
import { restorePartner, setPartnerActive } from "./mutations";
import { PartnersTable } from "./partners-table";
import { PartnersCardList } from "./partners-card-list";
import { PartnerFormDialog } from "./partner-form-dialog";
import { DeletePartnerDialog } from "./delete-partner-dialog";
import { pendingReimbursementsKeys } from "./queries/pending-reimbursements";

export function ManagePartnersDrawer({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const isMobile = useIsMobile();
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [showDeleted, setShowDeleted] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
    txnCount: number;
  } | null>(null);

  const { data: partners, isLoading, isError, error } = useQuery({
    queryKey: partnerKeys.list(),
    queryFn: listPartnersWithStats,
    enabled: open,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: partnerKeys.all });
    qc.invalidateQueries({ queryKey: transactionKeys.partners() });
    qc.invalidateQueries({ queryKey: pendingReimbursementsKeys.all });
  };

  const toggleActiveMut = useMutation({
    mutationFn: ({ id, next }: { id: string; next: boolean }) =>
      setPartnerActive(id, next),
    onSuccess: (_data, vars) => {
      invalidate();
      toast.success(vars.next ? "Partner reactivated" : "Partner deactivated");
    },
    onError: (e: Error) => toast.error(e.message ?? "Failed to update"),
  });

  const restoreMut = useMutation({
    mutationFn: (id: string) => restorePartner(id),
    onSuccess: () => {
      invalidate();
      toast.success("Partner restored");
    },
    onError: (e: Error) => toast.error(e.message ?? "Failed to restore"),
  });

  const deletedCount = useMemo(
    () => (partners ?? []).filter((p) => p.deleted_at !== null).length,
    [partners],
  );

  const filtered = useMemo(() => {
    if (!partners) return [];
    const term = search.trim().toLowerCase();
    const base = partners.filter((p) => {
      if (!showDeleted && p.deleted_at !== null) return false;
      if (term && !p.name.toLowerCase().includes(term)) return false;
      return true;
    });
    return base.slice().sort((a, b) => {
      const aDel = a.deleted_at ? 1 : 0;
      const bDel = b.deleted_at ? 1 : 0;
      if (aDel !== bDel) return aDel - bDel;
      if (a.is_active !== b.is_active) return a.is_active ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }, [partners, search, showDeleted]);

  const openCreate = () => {
    setEditingId(null);
    setFormOpen(true);
  };
  const openRename = (id: string) => {
    setEditingId(id);
    setFormOpen(true);
  };
  const openDelete = (p: PartnerWithStats) => {
    setDeleteTarget({ id: p.id, name: p.name, txnCount: p.transaction_count });
    setDeleteOpen(true);
  };

  const hasFiltered = filtered.length > 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full gap-0 overflow-y-auto sm:max-w-2xl"
      >
        <SheetHeader className="border-b">
          <SheetTitle>Manage partners</SheetTitle>
          <SheetDescription>
            Add, rename, deactivate, or delete business partners.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search partners…"
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-2">
              {deletedCount > 0 ? (
                <Button
                  variant={showDeleted ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowDeleted((v) => !v)}
                >
                  {showDeleted
                    ? `Hide deleted (${deletedCount})`
                    : `Show deleted (${deletedCount})`}
                </Button>
              ) : null}
              <Button onClick={openCreate} size="sm">
                <Plus className="mr-2 size-4" />
                Add partner
              </Button>
            </div>
          </div>

          {isLoading ? (
            <div className="space-y-2 rounded-lg border bg-card p-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : null}

          {isError ? (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
              Failed to load partners: {(error as Error).message}
            </div>
          ) : null}

          {!isLoading && !isError && !hasFiltered ? (
            <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
              No partners match the current filters.
            </div>
          ) : null}

          {!isLoading && hasFiltered ? (
            isMobile ? (
              <PartnersCardList
                partners={filtered}
                onRename={openRename}
                onToggleActive={(id, next) =>
                  toggleActiveMut.mutate({ id, next })
                }
                onDelete={openDelete}
                onRestore={(id) => restoreMut.mutate(id)}
              />
            ) : (
              <PartnersTable
                partners={filtered}
                onRename={openRename}
                onToggleActive={(id, next) =>
                  toggleActiveMut.mutate({ id, next })
                }
                onDelete={openDelete}
                onRestore={(id) => restoreMut.mutate(id)}
              />
            )
          ) : null}
        </div>

        <PartnerFormDialog
          open={formOpen}
          onOpenChange={(o) => {
            setFormOpen(o);
            if (!o) setEditingId(null);
          }}
          partnerId={editingId}
        />

        {deleteTarget ? (
          <DeletePartnerDialog
            open={deleteOpen}
            onOpenChange={(o) => {
              setDeleteOpen(o);
              if (!o) setDeleteTarget(null);
            }}
            partnerId={deleteTarget.id}
            partnerName={deleteTarget.name}
            transactionCount={deleteTarget.txnCount}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
