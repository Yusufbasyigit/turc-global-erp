import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { derivedCbmPerUnit } from "@/lib/shipments/dimensions";
import type { ProductWithRelations } from "@/lib/supabase/types";

export const MUST_HAVE_PRODUCT_FIELDS = [
  "default_supplier",
  "hs_code",
  "cbm_per_unit",
  "weight_kg_per_unit",
] as const;

export type MustHaveProductField = (typeof MUST_HAVE_PRODUCT_FIELDS)[number];

// CBM per unit is considered present when either the explicit value is set
// or it can be derived from packaging dims + units_per_package — the rest
// of the app already falls back this way (see effectiveCbmPerUnit).
function hasUsableCbm(p: ProductWithRelations): boolean {
  if (p.cbm_per_unit !== null) return true;
  return (
    derivedCbmPerUnit({
      package_length_cm: p.package_length_cm,
      package_width_cm: p.package_width_cm,
      package_height_cm: p.package_height_cm,
      units_per_package: p.units_per_package,
    }) !== null
  );
}

export function productMissingFields(
  p: ProductWithRelations,
): Set<MustHaveProductField> {
  const missing = new Set<MustHaveProductField>();
  if (p.default_supplier === null) missing.add("default_supplier");
  if (!p.hs_code || p.hs_code.trim() === "") missing.add("hs_code");
  if (!hasUsableCbm(p)) missing.add("cbm_per_unit");
  if (p.weight_kg_per_unit === null) missing.add("weight_kg_per_unit");
  return missing;
}

export function productNeedsDetails(p: ProductWithRelations): boolean {
  return productMissingFields(p).size > 0;
}

export function NeedsDetailsBadge({ className }: { className?: string }) {
  return (
    <Badge
      variant="outline"
      title="Missing supplier, HS code, CBM per unit (or packaging dims), or weight per unit."
      className={cn(
        "border-transparent bg-amber-500/15 text-amber-800",
        className,
      )}
    >
      Needs details
    </Badge>
  );
}
