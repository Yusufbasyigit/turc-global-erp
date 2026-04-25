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
    "border-transparent bg-zinc-500/15 text-zinc-300 hover:bg-zinc-500/20",
  quoted:
    "border-transparent bg-sky-500/15 text-sky-300 hover:bg-sky-500/20",
  accepted:
    "border-transparent bg-indigo-500/15 text-indigo-300 hover:bg-indigo-500/20",
  in_production:
    "border-transparent bg-amber-500/15 text-amber-300 hover:bg-amber-500/20",
  shipped:
    "border-transparent bg-violet-500/15 text-violet-300 hover:bg-violet-500/20",
  delivered:
    "border-transparent bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/20",
  cancelled:
    "border-transparent bg-rose-500/15 text-rose-300 hover:bg-rose-500/20",
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
