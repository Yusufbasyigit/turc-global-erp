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
  Search,
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
import { formatUsd } from "@/features/treasury/fx-utils";
import {
  listFxSnapshots,
  treasuryKeys,
} from "@/features/treasury/queries";
import { todayIsoDate } from "@/lib/proforma/istanbul-date";
import type {
  FxSnapshot,
  OrderStatus,
  OrderWithRelations,
} from "@/lib/supabase/types";
import { ORDER_STATUSES } from "@/lib/supabase/types";

import {
  ORDER_LIFECYCLE,
  ORDER_STATUS_BADGE_CLASSES,
  ORDER_STATUS_LABELS,
  ageBucketForOrder,
  type AgingBucket,
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
    // quantity is NOT NULL in schema; a null/NaN here means data corruption,
    // not a missing value. Surface it in the console so it doesn't silently
    // become a $0 row.
    if (l.quantity === null || Number.isNaN(Number(l.quantity))) {
      if (typeof console !== "undefined") {
        console.warn(
          `orderTotal: order ${o.id} has line with null/NaN quantity`,
          l,
        );
      }
      continue;
    }
    const qty = Number(l.quantity);
    const price = Number(l.unit_sales_price ?? 0);
    total += qty * price;
  }
  return total;
}

// USD rate for a given native currency. USD itself is 1; other currencies use
// the latest fx_snapshots row. Returns null when no rate is available so the
// UI can render `—` rather than guessing.
function usdRate(
  currency: string | null,
  fxMap: Map<string, FxSnapshot>,
): number | null {
  if (!currency) return null;
  const code = currency.toUpperCase();
  if (code === "USD") return 1;
  const fx = fxMap.get(code);
  return fx ? Number(fx.rate_to_usd) : null;
}

function orderUsdTotal(
  o: OrderWithRelations,
  fxMap: Map<string, FxSnapshot>,
): number | null {
  const total = orderTotal(o);
  if (total <= 0) return null;
  const rate = usdRate(o.order_currency, fxMap);
  if (rate === null) return null;
  return total * rate;
}

// Diff in whole days between two YYYY-MM-DD strings (orderDate → today).
// Anchors at UTC noon so DST transitions can't push a same-day diff to ±1.
function daysSince(orderDate: string | null, today: string): number {
  if (!orderDate) return 0;
  const a = new Date(`${orderDate.slice(0, 10)}T12:00:00Z`).getTime();
  const b = new Date(`${today.slice(0, 10)}T12:00:00Z`).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

const AGING_TAG_CLASSES: Record<AgingBucket, string> = {
  ok: "text-muted-foreground/60",
  warn: "text-amber-700",
  alarm: "text-rose-700 font-semibold",
  none: "",
};

export function OrdersIndex() {
  const [formOpen, setFormOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<Set<OrderStatus>>(
    () => new Set(),
  );
  const [statusFilterOpen, setStatusFilterOpen] = useState(false);
  const [groupBy, setGroupBy] = useState<GroupBy>("flat");
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [onlyStuck, setOnlyStuck] = useState(false);

  const ordersQ = useQuery({
    queryKey: orderKeys.list(),
    queryFn: listOrders,
  });

  const fxQ = useQuery({
    queryKey: treasuryKeys.fx(),
    queryFn: listFxSnapshots,
  });

  const orders = useMemo(() => ordersQ.data ?? [], [ordersQ.data]);

  // Latest snapshot per currency code (the query orders by fetched_at desc, so
  // the first occurrence wins). Keyed by uppercase code so lookups are
  // currency-case-insensitive.
  const fxMap = useMemo(() => {
    const m = new Map<string, FxSnapshot>();
    for (const s of fxQ.data ?? []) {
      const code = s.currency_code?.toUpperCase();
      if (!code) continue;
      if (!m.has(code)) m.set(code, s);
    }
    return m;
  }, [fxQ.data]);

  const today = useMemo(() => todayIsoDate(), []);

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return orders.filter((o) => {
      if (statusFilter.size > 0 && !statusFilter.has(o.status as OrderStatus)) {
        return false;
      }
      if (dateFrom && (o.order_date ?? "") < dateFrom) return false;
      if (dateTo && (o.order_date ?? "") > dateTo) return false;
      if (term) {
        const haystack = [
          o.id.slice(0, 8),
          o.offer_number ?? "",
          o.customer?.company_name ?? "",
          o.shipment?.name ?? "",
          o.notes ?? "",
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      if (onlyStuck) {
        const bucket = ageBucketForOrder(
          o.status as OrderStatus,
          daysSince(o.order_date, today),
        );
        if (bucket !== "warn" && bucket !== "alarm") return false;
      }
      return true;
    });
  }, [orders, statusFilter, searchTerm, dateFrom, dateTo, onlyStuck, today]);

  const overallTotalUsd = useMemo(() => {
    let sum = 0;
    let any = false;
    for (const o of filtered) {
      const u = orderUsdTotal(o, fxMap);
      if (u !== null) {
        sum += u;
        any = true;
      }
    }
    return any ? sum : null;
  }, [filtered, fxMap]);

  const filtersActive =
    statusFilter.size > 0 ||
    searchTerm.length > 0 ||
    Boolean(dateFrom) ||
    Boolean(dateTo) ||
    onlyStuck;

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

      <div className="flex flex-wrap items-center gap-2 border-b pb-3">
        <div className="relative flex-1 min-w-[14rem] max-w-md">
          <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by customer, offer #, ID, shipment, or notes…"
            className="w-full rounded-md border bg-background py-1 pl-7 pr-2 text-xs outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <span className="mx-1 text-muted-foreground/40">·</span>
        <label className="text-xs text-muted-foreground">From</label>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="rounded-md border bg-background px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-primary"
        />
        <label className="text-xs text-muted-foreground">To</label>
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="rounded-md border bg-background px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-primary"
        />
        <span className="mx-1 text-muted-foreground/40">·</span>
        <label
          className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground"
          title="Show only orders past the warn-age threshold for their current status"
        >
          <input
            type="checkbox"
            checked={onlyStuck}
            onChange={(e) => setOnlyStuck(e.target.checked)}
            className="size-3.5 rounded border-border text-primary focus:ring-1 focus:ring-primary"
          />
          Only stuck
        </label>
        {filtersActive ? (
          <button
            type="button"
            onClick={() => {
              setSearchTerm("");
              setDateFrom("");
              setDateTo("");
              setStatusFilter(new Set());
              setOnlyStuck(false);
            }}
            className="ml-auto rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
          >
            Clear filters
          </button>
        ) : null}
      </div>

      {filtered.length > 0 ? (
        <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs text-muted-foreground">
          <div>
            <span className="tabular-nums">{filtered.length}</span>{" "}
            order{filtered.length === 1 ? "" : "s"}
            {filtersActive && orders.length !== filtered.length ? (
              <span className="text-muted-foreground/60">
                {" "}
                of {orders.length}
              </span>
            ) : null}
          </div>
          <div title="Sum of order totals across visible rows, converted to USD at today's spot FX. Historical orders are not pinned to their booking-date rate.">
            Pipeline value:{" "}
            <span className="font-medium tabular-nums text-foreground">
              {overallTotalUsd === null ? "—" : formatUsd(overallTotalUsd)}
            </span>
          </div>
        </div>
      ) : null}

      {ordersQ.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        orders.length === 0 ? (
          <EmptyState onCreate={() => setFormOpen(true)} />
        ) : (
          <FilteredEmptyState
            onClear={() => {
              setSearchTerm("");
              setDateFrom("");
              setDateTo("");
              setStatusFilter(new Set());
              setOnlyStuck(false);
            }}
          />
        )
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
                      <th className="px-3 py-2 text-left">Order #</th>
                      <th className="px-3 py-2 text-left">Date</th>
                      <th className="px-3 py-2 text-left">Customer</th>
                      <th className="px-3 py-2 text-left">Status</th>
                      <th className="px-3 py-2 text-right">Lines</th>
                      <th className="px-3 py-2 text-right">Total</th>
                      <th
                        className="px-3 py-2 text-right"
                        title="Order total converted to USD at today's spot FX. Historical orders are not pinned to their booking-date rate."
                      >
                        USD
                      </th>
                      <th className="px-3 py-2 text-left">Shipment</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {g.rows.map((o) => {
                      const dimmed = o.status === "cancelled";
                      const total = orderTotal(o);
                      const usd = orderUsdTotal(o, fxMap);
                      const status = o.status as OrderStatus;
                      const ageDays = daysSince(o.order_date, today);
                      const bucket = ageBucketForOrder(status, ageDays);
                      return (
                        <tr
                          key={o.id}
                          className={cn(
                            "transition-colors hover:bg-muted/30",
                            dimmed && "opacity-60",
                          )}
                        >
                          <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">
                            <Link
                              href={`/orders/${o.id}`}
                              className={cn(
                                "hover:underline",
                                o.offer_number
                                  ? "text-primary"
                                  : "text-muted-foreground",
                              )}
                            >
                              {o.offer_number ?? o.id.slice(0, 8)}
                            </Link>
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            {formatDateShort(o.order_date)}
                          </td>
                          <td className="px-3 py-2">
                            {o.customer?.company_name ?? "—"}
                          </td>
                          <td className="px-3 py-2">
                            <div className="inline-flex items-center gap-1.5">
                              <Badge
                                className={cn(
                                  "text-[10px]",
                                  ORDER_STATUS_BADGE_CLASSES[status],
                                )}
                              >
                                {ORDER_STATUS_LABELS[status] ?? o.status}
                              </Badge>
                              {bucket !== "none" ? (
                                <span
                                  className={cn(
                                    "font-mono text-[10px] tabular-nums",
                                    AGING_TAG_CLASSES[bucket],
                                  )}
                                  title={
                                    bucket === "alarm"
                                      ? `Stuck in ${ORDER_STATUS_LABELS[status]} for ${ageDays} days — needs attention`
                                      : bucket === "warn"
                                        ? `Has been in ${ORDER_STATUS_LABELS[status]} for ${ageDays} days`
                                        : `${ageDays} day${ageDays === 1 ? "" : "s"} since order date`
                                  }
                                >
                                  {ageDays}d
                                </span>
                              ) : null}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {o.line_count ?? 0}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {total > 0
                              ? formatMoney(total, o.order_currency)
                              : "—"}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                            {usd === null ? "—" : formatUsd(usd)}
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
                  {groupBy !== "flat" ? (
                    <tfoot className="border-t bg-muted/30 text-xs">
                      <tr>
                        <td className="px-3 py-2 text-muted-foreground" colSpan={4}>
                          {g.rows.length} order
                          {g.rows.length === 1 ? "" : "s"}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                          {g.rows.reduce((acc, o) => acc + (o.line_count ?? 0), 0)}
                        </td>
                        <td className="px-3 py-2" />
                        <td className="px-3 py-2 text-right tabular-nums font-medium">
                          {(() => {
                            let sum = 0;
                            let any = false;
                            for (const o of g.rows) {
                              const u = orderUsdTotal(o, fxMap);
                              if (u !== null) {
                                sum += u;
                                any = true;
                              }
                            }
                            return any ? formatUsd(sum) : "—";
                          })()}
                        </td>
                        <td className="px-3 py-2" />
                      </tr>
                    </tfoot>
                  ) : null}
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

function FilteredEmptyState({ onClear }: { onClear: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-12 text-center">
      <Search className="size-8 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">
        No orders match the current filters.
      </p>
      <Button variant="outline" onClick={onClear}>
        Clear filters
      </Button>
    </div>
  );
}
