import type { ContactType } from "@/lib/supabase/types";

export const CONTACT_TYPE_LABELS: Record<ContactType, string> = {
  customer: "Customer",
  supplier: "Supplier",
  logistics: "Logistics",
  other: "Other",
};

export const CONTACT_TYPE_BADGE_CLASSES: Record<ContactType, string> = {
  customer:
    "border-transparent bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/20",
  supplier:
    "border-transparent bg-sky-500/15 text-sky-300 hover:bg-sky-500/20",
  logistics:
    "border-transparent bg-amber-500/15 text-amber-300 hover:bg-amber-500/20",
  other:
    "border-transparent bg-zinc-500/15 text-zinc-300 hover:bg-zinc-500/20",
};
