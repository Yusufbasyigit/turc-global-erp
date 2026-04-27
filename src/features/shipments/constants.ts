import type { ShipmentStatus } from "@/lib/supabase/types";

export const SHIPMENT_STATUS_LABELS: Record<ShipmentStatus, string> = {
  draft: "Draft",
  booked: "Booked",
  in_transit: "In transit",
  arrived: "Arrived",
};

export const SHIPMENT_STATUS_BADGE_CLASSES: Record<ShipmentStatus, string> = {
  draft:
    "border-transparent bg-zinc-500/15 text-zinc-700 hover:bg-zinc-500/25",
  booked:
    "border-transparent bg-sky-500/15 text-sky-800 hover:bg-sky-500/25",
  in_transit:
    "border-transparent bg-amber-500/20 text-amber-800 hover:bg-amber-500/30",
  arrived:
    "border-transparent bg-emerald-500/15 text-emerald-800 hover:bg-emerald-500/25",
};

export const NEXT_SHIPMENT_STATUS: Partial<
  Record<ShipmentStatus, ShipmentStatus>
> = {
  draft: "booked",
  booked: "in_transit",
  in_transit: "arrived",
};

export const SHIPMENT_LIFECYCLE: readonly ShipmentStatus[] = [
  "draft",
  "booked",
  "in_transit",
  "arrived",
] as const;

export const CONTAINER_TYPE_OPTIONS = ["20DC", "40HC", "40RF"] as const;

export const TRANSPORT_METHOD_LABELS: Record<string, string> = {
  sea: "Sea",
  road: "Road",
  air: "Air",
  other: "Other",
};
