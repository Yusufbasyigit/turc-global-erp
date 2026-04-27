"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PACKAGING_TYPE_LABELS } from "@/lib/constants";
import { PACKAGING_TYPES } from "@/lib/supabase/types";
import type { OrderDetail, Product } from "@/lib/supabase/types";
import { createClient } from "@/lib/supabase/client";
import {
  derivedCbmPerUnit,
  packageCbm,
} from "@/lib/shipments/dimensions";

import { updateOrderLine } from "./mutations";
import { orderKeys } from "./queries";

type FieldState = {
  packaging_type: string | null;
  package_length_cm: string;
  package_width_cm: string;
  package_height_cm: string;
  units_per_package: string;
};

function fromLine(line: OrderDetail): FieldState {
  return {
    packaging_type: line.packaging_type,
    package_length_cm:
      line.package_length_cm === null ? "" : String(line.package_length_cm),
    package_width_cm:
      line.package_width_cm === null ? "" : String(line.package_width_cm),
    package_height_cm:
      line.package_height_cm === null ? "" : String(line.package_height_cm),
    units_per_package:
      line.units_per_package === null ? "" : String(line.units_per_package),
  };
}

export function PackagingOverrideDialog({
  open,
  onOpenChange,
  line,
  orderId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  line: OrderDetail;
  orderId: string;
}) {
  const qc = useQueryClient();
  const [state, setState] = useState<FieldState>(() => fromLine(line));

  useEffect(() => {
    if (open) setState(fromLine(line));
  }, [open, line]);

  const mut = useMutation({
    mutationFn: () =>
      updateOrderLine({
        line_id: line.id,
        payload: {
          packaging_type: state.packaging_type,
          package_length_cm:
            state.package_length_cm === ""
              ? null
              : Number(state.package_length_cm),
          package_width_cm:
            state.package_width_cm === ""
              ? null
              : Number(state.package_width_cm),
          package_height_cm:
            state.package_height_cm === ""
              ? null
              : Number(state.package_height_cm),
          units_per_package:
            state.units_per_package === ""
              ? null
              : Number(state.units_per_package),
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: orderKeys.detail(orderId) });
      qc.invalidateQueries({ queryKey: orderKeys.list() });
      toast.success("Packaging updated");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message ?? "Failed to save"),
  });

  const resetToProduct = async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("products")
      .select("packaging_type, package_length_cm, package_width_cm, package_height_cm, units_per_package")
      .eq("product_id", line.product_id)
      .maybeSingle();
    if (error) {
      toast.error(error.message);
      return;
    }
    if (!data) {
      toast.error("Original product not found.");
      return;
    }
    const p = data as Pick<
      Product,
      | "packaging_type"
      | "package_length_cm"
      | "package_width_cm"
      | "package_height_cm"
      | "units_per_package"
    >;
    setState({
      packaging_type: p.packaging_type,
      package_length_cm:
        p.package_length_cm === null ? "" : String(p.package_length_cm),
      package_width_cm:
        p.package_width_cm === null ? "" : String(p.package_width_cm),
      package_height_cm:
        p.package_height_cm === null ? "" : String(p.package_height_cm),
      units_per_package:
        p.units_per_package === null ? "" : String(p.units_per_package),
    });
    toast.success("Reset from product defaults");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Packaging override</DialogTitle>
          <DialogDescription>
            Override packaging for this line only. The original product row
            is not touched.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="space-y-1.5 md:col-span-2">
            <Label className="text-xs text-muted-foreground">Type</Label>
            <Select
              value={state.packaging_type ?? ""}
              onValueChange={(v) =>
                setState((s) => ({ ...s, packaging_type: v === "" ? null : v }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                {PACKAGING_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {PACKAGING_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Length (cm)</Label>
            <Input
              type="number"
              step="0.1"
              min="0"
              value={state.package_length_cm}
              onChange={(e) =>
                setState((s) => ({ ...s, package_length_cm: e.target.value }))
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Width (cm)</Label>
            <Input
              type="number"
              step="0.1"
              min="0"
              value={state.package_width_cm}
              onChange={(e) =>
                setState((s) => ({ ...s, package_width_cm: e.target.value }))
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Height (cm)</Label>
            <Input
              type="number"
              step="0.1"
              min="0"
              value={state.package_height_cm}
              onChange={(e) =>
                setState((s) => ({ ...s, package_height_cm: e.target.value }))
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              Units per package
            </Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={state.units_per_package}
              onChange={(e) =>
                setState((s) => ({ ...s, units_per_package: e.target.value }))
              }
            />
          </div>

          <DerivedVolumeHint
            line={line}
            state={state}
            quantity={Number(line.quantity ?? 0)}
          />
        </div>

        <button
          type="button"
          onClick={resetToProduct}
          className="self-start text-xs text-muted-foreground underline-offset-2 hover:underline"
        >
          Reset to product defaults
        </button>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
            {mut.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DerivedVolumeHint({
  line,
  state,
  quantity,
}: {
  line: OrderDetail;
  state: FieldState;
  quantity: number;
}) {
  const dims = {
    package_length_cm: state.package_length_cm,
    package_width_cm: state.package_width_cm,
    package_height_cm: state.package_height_cm,
    units_per_package: state.units_per_package,
  };
  const pkg = packageCbm(dims);
  const perUnit = derivedCbmPerUnit(dims);
  const explicit =
    line.cbm_per_unit_snapshot === null
      ? null
      : Number(line.cbm_per_unit_snapshot);
  const effective =
    explicit !== null && explicit > 0 ? explicit : perUnit;
  const lineCbm =
    effective !== null && quantity > 0 ? effective * quantity : null;
  if (pkg === null && perUnit === null && explicit === null) return null;
  return (
    <div className="md:col-span-2 rounded-md border bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground">
      {pkg !== null ? (
        <div>
          Package volume:{" "}
          <span className="font-medium tabular-nums text-foreground">
            {pkg.toFixed(4)} m³
          </span>
        </div>
      ) : null}
      {perUnit !== null ? (
        <div>
          Derived per-unit CBM:{" "}
          <span className="font-medium tabular-nums text-foreground">
            {perUnit.toFixed(4)} m³
          </span>
          {explicit !== null && explicit > 0 ? (
            <span className="ml-1">
              (line snapshot {explicit.toFixed(4)} m³ wins)
            </span>
          ) : (
            <span className="ml-1 text-emerald-700">
              — used because line snapshot is blank
            </span>
          )}
        </div>
      ) : null}
      {lineCbm !== null ? (
        <div>
          Line contribution at qty {quantity}:{" "}
          <span className="font-medium tabular-nums text-foreground">
            {lineCbm.toFixed(4)} m³
          </span>
        </div>
      ) : null}
    </div>
  );
}
