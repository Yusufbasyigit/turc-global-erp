"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Check,
  ChevronDown,
  Plus,
  Ship,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import type { ShipmentStatus } from "@/lib/supabase/types";
import { SHIPMENT_STATUSES } from "@/lib/supabase/types";

import {
  SHIPMENT_STATUS_BADGE_CLASSES,
  SHIPMENT_STATUS_LABELS,
  TRANSPORT_METHOD_LABELS,
} from "./constants";
import { listShipments, shipmentKeys } from "./queries";
import { ShipmentFormDialog } from "./shipment-form-dialog";
import { formatDateOnly } from "@/lib/format-date";
import {
  containerFillSummary,
  isKnownContainer,
} from "@/lib/shipments/dimensions";

const formatDate = (d: string | null) => formatDateOnly(d);

export function ShipmentsIndex() {
  const [formOpen, setFormOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<Set<ShipmentStatus>>(
    () => new Set(),
  );
  const [statusFilterOpen, setStatusFilterOpen] = useState(false);

  const shipmentsQ = useQuery({
    queryKey: shipmentKeys.list(),
    queryFn: listShipments,
  });

  const shipments = useMemo(() => shipmentsQ.data ?? [], [shipmentsQ.data]);
  const filtered = useMemo(() => {
    if (statusFilter.size === 0) return shipments;
    return shipments.filter((s) =>
      statusFilter.has(s.status as ShipmentStatus),
    );
  }, [shipments, statusFilter]);

  const label = useMemo(() => {
    if (statusFilter.size === 0) return "All statuses";
    if (statusFilter.size === 1) {
      const only = Array.from(statusFilter)[0];
      return SHIPMENT_STATUS_LABELS[only] ?? only;
    }
    return `${statusFilter.size} statuses`;
  }, [statusFilter]);

  const toggle = (s: ShipmentStatus) => {
    setStatusFilter((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  };

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Shipments</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Physical and financial groupings of orders.
          </p>
        </div>
        <Button onClick={() => setFormOpen(true)}>
          <Plus className="mr-2 size-4" /> New shipment
        </Button>
      </header>

      <div className="flex flex-wrap items-center gap-2 border-y py-3">
        <label className="text-xs text-muted-foreground">Status</label>
        <Popover open={statusFilterOpen} onOpenChange={setStatusFilterOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-md border bg-background px-2 py-1 text-xs hover:bg-muted/50"
            >
              <span>{label}</span>
              <ChevronDown className="size-3 text-muted-foreground" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-52 p-0">
            <Command>
              <CommandInput placeholder="Search…" />
              <CommandList>
                <CommandEmpty>None match.</CommandEmpty>
                <CommandGroup>
                  {SHIPMENT_STATUSES.map((s) => {
                    const checked = statusFilter.has(s);
                    return (
                      <CommandItem
                        key={s}
                        value={SHIPMENT_STATUS_LABELS[s]}
                        onSelect={() => toggle(s)}
                      >
                        <div
                          className={cn(
                            "mr-2 flex size-4 items-center justify-center rounded border",
                            checked
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border",
                          )}
                        >
                          {checked ? <Check className="size-3" /> : null}
                        </div>
                        {SHIPMENT_STATUS_LABELS[s]}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {shipmentsQ.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState onCreate={() => setFormOpen(true)} />
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="min-w-full divide-y text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Name</th>
                <th className="px-3 py-2 text-left">Customer</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Transport</th>
                <th className="px-3 py-2 text-left">Container</th>
                <th className="px-3 py-2 text-left">ETD</th>
                <th className="px-3 py-2 text-left">ETA</th>
                <th className="px-3 py-2 text-right">Orders</th>
                <th className="px-3 py-2 text-right">CBM</th>
                <th className="px-3 py-2 text-right">Weight (kg)</th>
                <th className="px-3 py-2 text-right">Fill</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((s) => {
                const fill = isKnownContainer(s.container_type)
                  ? containerFillSummary(s.container_type, {
                      cbm: s.total_cbm,
                      weightKg: s.total_weight_kg,
                    })
                  : null;
                const fillPct = fill
                  ? Math.max(fill.fill.cbm, fill.fill.weightKg)
                  : null;
                const fillTone = fill
                  ? fill.overCbm || fill.overWeight
                    ? "text-rose-400"
                    : fill.tightCbm || fill.tightWeight
                      ? "text-amber-400"
                      : "text-muted-foreground"
                  : "text-muted-foreground";
                return (
                  <tr
                    key={s.id}
                    className="transition-colors hover:bg-muted/30"
                  >
                    <td className="px-3 py-2">
                      <Link
                        href={`/shipments/${s.id}`}
                        className="text-primary hover:underline"
                      >
                        {s.name}
                      </Link>
                    </td>
                    <td className="px-3 py-2">
                      {s.customer?.company_name ?? "—"}
                    </td>
                    <td className="px-3 py-2">
                      <Badge
                        className={cn(
                          "text-[10px]",
                          SHIPMENT_STATUS_BADGE_CLASSES[
                            s.status as ShipmentStatus
                          ],
                        )}
                      >
                        {SHIPMENT_STATUS_LABELS[s.status as ShipmentStatus] ??
                          s.status}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {s.transport_method
                        ? TRANSPORT_METHOD_LABELS[s.transport_method] ??
                          s.transport_method
                        : "—"}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {s.container_type ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {formatDate(s.etd_date)}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {formatDate(s.eta_date)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {s.order_count}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {s.total_cbm > 0 ? s.total_cbm.toFixed(2) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {s.total_weight_kg > 0
                        ? s.total_weight_kg.toLocaleString(undefined, {
                            maximumFractionDigits: 0,
                          })
                        : "—"}
                    </td>
                    <td
                      className={cn(
                        "px-3 py-2 text-right text-xs tabular-nums",
                        fillTone,
                      )}
                    >
                      {fillPct !== null
                        ? `${(fillPct * 100).toFixed(0)}%`
                        : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Button
        type="button"
        onClick={() => setFormOpen(true)}
        size="icon"
        className="fixed bottom-6 right-6 size-12 rounded-full shadow-lg md:hidden"
      >
        <Plus className="size-5" />
      </Button>

      <ShipmentFormDialog open={formOpen} onOpenChange={setFormOpen} />
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-12 text-center">
      <Ship className="size-8 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">
        No shipments yet. Create your first shipment.
      </p>
      <Button onClick={onCreate}>
        <Plus className="mr-2 size-4" /> New shipment
      </Button>
    </div>
  );
}
