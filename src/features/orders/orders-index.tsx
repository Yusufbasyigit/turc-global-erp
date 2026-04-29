"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Check,
  ChevronDown,
  ClipboardList,
  ExternalLink,
  Plus,
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
import { formatCurrency as formatMoney } from "@/lib/format-money";
import { formatDateOnly } from "@/lib/format-date";
import type {
  OrderStatus,
  OrderWithRelations,
} from "@/lib/supabase/types";
import { ORDER_STATUSES } from "@/lib/supabase/types";

import {
  ORDER_LIFECYCLE,
  ORDER_STATUS_BADGE_CLASSES,
  ORDER_STATUS_LABELS,
} from "./constants";
import { listOrders, orderKeys } from "./queries";
import { OrderFormDialog } from "./order-form-dialog";

type GroupBy = "flat" | "customer" | "status" | "shipment";

function formatDateShort(dateStr: string | null): string {
  return formatDateOnly(dateStr);
}

function orderTotal(o: OrderWithRelations): number {
  const lines = o.order_details ?? [];
  let total = 0;
  for (const l of lines) {
    const qty = Number(l.quantity ?? 0);
    const price = Number(l.unit_sales_price ?? 0);
    total += qty * price;
  }
  return total;
}

export function OrdersIndex() {
  const [formOpen, setFormOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<Set<OrderStatus>>(
    () => new Set(),
  );
  const [statusFilterOpen, setStatusFilterOpen] = useState(false);
  const [groupBy, setGroupBy] = useState<GroupBy>("flat");

  const ordersQ = useQuery({
    queryKey: orderKeys.list(),
    queryFn: listOrders,
  });

  const orders = useMemo(() => ordersQ.data ?? [], [ordersQ.data]);

  const filtered = useMemo(() => {
    if (statusFilter.size === 0) return orders;
    return orders.filter((o) =>
      statusFilter.has(o.status as OrderStatus),
    );
  }, [orders, statusFilter]);

  const statusLabel = useMemo(() => {
    if (statusFilter.size === 0) return "All statuses";
    if (statusFilter.size === 1) {
      const only = Array.from(statusFilter)[0];
      return ORDER_STATUS_LABELS[only] ?? only;
    }
    return `${statusFilter.size} statuses`;
  }, [statusFilter]);

  const toggleStatus = (s: OrderStatus) => {
    setStatusFilter((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  };

  const groups = useMemo(() => {
    if (groupBy === "flat") return [{ title: null, rows: filtered }];
    const map = new Map<string, OrderWithRelations[]>();
    for (const o of filtered) {
      let key: string;
      if (groupBy === "customer") {
        key = o.customer?.company_name ?? "Unknown customer";
      } else if (groupBy === "status") {
        // Use the raw status as the key so we can sort by lifecycle order;
        // the label is computed at render time.
        key = o.status as string;
      } else {
        key = o.shipment?.name ?? "Unassigned";
      }
      const arr = map.get(key) ?? [];
      arr.push(o);
      map.set(key, arr);
    }
    const entries = Array.from(map.entries());
    if (groupBy === "status") {
      const lifecycleOrder = (s: string) => {
        const idx = (ORDER_LIFECYCLE as readonly string[]).indexOf(s);
        // Cancelled (and any unknown statuses) sort after the lifecycle.
        return idx === -1 ? ORDER_LIFECYCLE.length + 1 : idx;
      };
      entries.sort(([a], [b]) => lifecycleOrder(a) - lifecycleOrder(b));
      return entries.map(([k, rows]) => ({
        title: ORDER_STATUS_LABELS[k as OrderStatus] ?? k,
        rows,
      }));
    }
    return entries
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, rows]) => ({ title: k, rows }));
  }, [filtered, groupBy]);

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Orders</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every client order, from inquiry through delivery.
          </p>
        </div>
        <Button onClick={() => setFormOpen(true)}>
          <Plus className="mr-2 size-4" /> New order
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
              <span>{statusLabel}</span>
              <ChevronDown className="size-3 text-muted-foreground" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-56 p-0">
            <Command>
              <CommandInput placeholder="Search statuses…" />
              <CommandList>
                <CommandEmpty>None match.</CommandEmpty>
                <CommandGroup>
                  {ORDER_STATUSES.map((s) => {
                    const checked = statusFilter.has(s);
                    return (
                      <CommandItem
                        key={s}
                        value={ORDER_STATUS_LABELS[s]}
                        onSelect={() => toggleStatus(s)}
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
                        {ORDER_STATUS_LABELS[s]}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </CommandList>
              {statusFilter.size > 0 ? (
                <div className="border-t p-1">
                  <button
                    type="button"
                    onClick={() => setStatusFilter(new Set())}
                    className="w-full rounded px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-muted"
                  >
                    Clear selection
                  </button>
                </div>
              ) : null}
            </Command>
          </PopoverContent>
        </Popover>
        <span className="mx-2 text-muted-foreground/40">·</span>
        <label className="text-xs text-muted-foreground">Group by</label>
        <div className="inline-flex rounded-md border p-0.5 text-xs">
          {(["flat", "customer", "status", "shipment"] as GroupBy[]).map(
            (g) => (
              <button
                type="button"
                key={g}
                onClick={() => setGroupBy(g)}
                className={cn(
                  "rounded px-2 py-1 capitalize",
                  groupBy === g
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground",
                )}
              >
                {g}
              </button>
            ),
          )}
        </div>
      </div>

      {ordersQ.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState onCreate={() => setFormOpen(true)} />
      ) : (
        <div className="flex flex-col gap-8">
          {groups.map((g) => (
            <section key={g.title ?? "__flat__"} className="flex flex-col gap-2">
              {g.title ? (
                <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {g.title}
                </h2>
              ) : null}
              <div className="overflow-x-auto rounded-md border">
                <table className="min-w-full divide-y text-sm">
                  <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left">ID</th>
                      <th className="px-3 py-2 text-left">Date</th>
                      <th className="px-3 py-2 text-left">Customer</th>
                      <th className="px-3 py-2 text-left">Status</th>
                      <th className="px-3 py-2 text-right">Lines</th>
                      <th className="px-3 py-2 text-right">Total</th>
                      <th className="px-3 py-2 text-left">Shipment</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {g.rows.map((o) => {
                      const dimmed = o.status === "cancelled";
                      const total = orderTotal(o);
                      return (
                        <tr
                          key={o.id}
                          className={cn(
                            "transition-colors hover:bg-muted/30",
                            dimmed && "opacity-60",
                          )}
                        >
                          <td className="px-3 py-2 font-mono text-xs">
                            <Link
                              href={`/orders/${o.id}`}
                              className="text-primary hover:underline"
                            >
                              {o.id.slice(0, 8)}
                            </Link>
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            {formatDateShort(o.order_date)}
                          </td>
                          <td className="px-3 py-2">
                            {o.customer?.company_name ?? "—"}
                          </td>
                          <td className="px-3 py-2">
                            <Badge
                              className={cn(
                                "text-[10px]",
                                ORDER_STATUS_BADGE_CLASSES[
                                  o.status as OrderStatus
                                ],
                              )}
                            >
                              {ORDER_STATUS_LABELS[o.status as OrderStatus] ??
                                o.status}
                            </Badge>
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {o.line_count ?? 0}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {total > 0
                              ? formatMoney(total, o.order_currency)
                              : "—"}
                          </td>
                          <td className="px-3 py-2">
                            {o.shipment ? (
                              <Link
                                href={`/shipments/${o.shipment.id}`}
                                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                              >
                                {o.shipment.name}
                                <ExternalLink className="size-3" />
                              </Link>
                            ) : (
                              <span className="text-xs text-muted-foreground/60">
                                —
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
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

      <OrderFormDialog open={formOpen} onOpenChange={setFormOpen} />
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-12 text-center">
      <ClipboardList className="size-8 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">
        No orders yet. Create your first order.
      </p>
      <Button onClick={onCreate}>
        <Plus className="mr-2 size-4" /> New order
      </Button>
    </div>
  );
}
