import type { OrderStatus } from "@/lib/supabase/types";

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  inquiry: "Inquiry",
  quoted: "Quoted",
  accepted: "Accepted",
  in_production: "In production",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export const ORDER_STATUS_BADGE_CLASSES: Record<OrderStatus, string> = {
  inquiry:
    "border-transparent bg-zinc-500/15 text-zinc-700 hover:bg-zinc-500/25",
  quoted:
    "border-transparent bg-sky-500/15 text-sky-800 hover:bg-sky-500/25",
  accepted:
    "border-transparent bg-indigo-500/15 text-indigo-800 hover:bg-indigo-500/25",
  in_production:
    "border-transparent bg-amber-500/20 text-amber-800 hover:bg-amber-500/30",
  shipped:
    "border-transparent bg-violet-500/15 text-violet-800 hover:bg-violet-500/25",
  delivered:
    "border-transparent bg-emerald-500/15 text-emerald-800 hover:bg-emerald-500/25",
  cancelled:
    "border-transparent bg-rose-500/15 text-rose-800 hover:bg-rose-500/25",
};

// Terminal statuses — cannot advance, cannot cancel.
export const TERMINAL_ORDER_STATUSES: readonly OrderStatus[] = [
  "delivered",
  "cancelled",
] as const;

// Non-cancel forward transitions. Any non-terminal status can also go to
// 'cancelled' (handled separately via cancelOrder).
export const NEXT_ORDER_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  inquiry: "quoted",
  quoted: "accepted",
  accepted: "in_production",
  in_production: "shipped",
  shipped: "delivered",
};

export const ORDER_LIFECYCLE: readonly OrderStatus[] = [
  "inquiry",
  "quoted",
  "accepted",
  "in_production",
  "shipped",
  "delivered",
] as const;

// Days an order is allowed to sit in each non-terminal status before the UI
// flags it as stuck. The export cycle naturally takes weeks, so the warn
// threshold is "starting to look slow" and alarm is "needs attention now."
// Tuned per status because the expected dwell time differs (an inquiry that
// hasn't moved in 14 days is suspicious; in_production legitimately runs
// 4-6 weeks).
export const STUCK_THRESHOLDS_DAYS: Partial<
  Record<OrderStatus, { warn: number; alarm: number }>
> = {
  inquiry: { warn: 14, alarm: 30 },
  quoted: { warn: 30, alarm: 60 },
  accepted: { warn: 30, alarm: 60 },
  in_production: { warn: 45, alarm: 90 },
  shipped: { warn: 30, alarm: 60 },
};

export type AgingBucket = "ok" | "warn" | "alarm" | "none";

export function ageBucketForOrder(
  status: OrderStatus,
  days: number,
): AgingBucket {
  const t = STUCK_THRESHOLDS_DAYS[status];
  if (!t) return "none";
  if (!Number.isFinite(days) || days < 0) return "ok";
  if (days >= t.alarm) return "alarm";
  if (days >= t.warn) return "warn";
  return "ok";
}
