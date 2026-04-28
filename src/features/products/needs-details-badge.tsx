import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ProductWithRelations } from "@/lib/supabase/types";

export function productNeedsDetails(p: ProductWithRelations): boolean {
  return (
    p.hs_code === null &&
    (p.cbm_per_unit === null || p.weight_kg_per_unit === null) &&
    p.category_id === null
  );
}

export function NeedsDetailsBadge({ className }: { className?: string }) {
  return (
    <Badge
      variant="outline"
      title="Missing HS code, packaging, or category — likely created from a proforma."
      className={cn(
        "border-transparent bg-amber-500/15 text-amber-800",
        className,
      )}
    >
      Needs details
    </Badge>
  );
}
