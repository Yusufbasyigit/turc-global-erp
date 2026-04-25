"use client";

import { useEffect, useMemo } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Combobox } from "@/components/ui/combobox";
import { cn } from "@/lib/utils";
import {
  ASSET_TYPES,
  ORTAK_MOVEMENT_TYPES,
  type CustodyLocation,
} from "@/lib/supabase/types";

import {
  addHoldingSchema,
  type AddHoldingOutput,
  type AddHoldingValues,
} from "./schema";
import { createAccountWithOpening } from "./mutations";
import { treasuryKeys } from "./queries";
import { todayDateString } from "./fx-utils";
import { ASSET_TYPE_LABELS, ORTAK_TYPE_LABELS } from "./constants";

const DEFAULT_VALUES: AddHoldingValues = {
  account_name: "",
  asset_code: "",
  asset_type: "fiat",
  custody_location_id: "",
  custody_requires_movement_type: false,
  quantity: "" as unknown as number,
  movement_date: todayDateString(),
  ortak_movement_type: null,
  notes: "",
};

export function AddHoldingDialog({
  open,
  onOpenChange,
  custodyLocations,
  existingAssetCodes,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  custodyLocations: CustodyLocation[];
  existingAssetCodes: string[];
}) {
  const qc = useQueryClient();

  const form = useForm<AddHoldingValues, unknown, AddHoldingOutput>({
    resolver: zodResolver(addHoldingSchema),
    defaultValues: DEFAULT_VALUES,
    mode: "onBlur",
  });

  useEffect(() => {
    if (open) form.reset({ ...DEFAULT_VALUES, movement_date: todayDateString() });
  }, [open, form]);

  const custodyId = useWatch({ control: form.control, name: "custody_location_id" });
  const selectedCustody = useMemo(
    () => custodyLocations.find((c) => c.id === custodyId) ?? null,
    [custodyLocations, custodyId],
  );

  useEffect(() => {
    form.setValue(
      "custody_requires_movement_type",
      Boolean(selectedCustody?.requires_movement_type),
      { shouldValidate: false },
    );
    if (!selectedCustody?.requires_movement_type) {
      form.setValue("ortak_movement_type", null);
    }
  }, [selectedCustody, form]);

  const activeCustody = useMemo(
    () => custodyLocations.filter((c) => c.is_active !== false),
    [custodyLocations],
  );

  const custodyItems = useMemo(
    () =>
      activeCustody.map((c) => ({
        value: c.id,
        label: `${c.name} (${c.location_type})`,
      })),
    [activeCustody],
  );

  const assetItems = useMemo(
    () => existingAssetCodes.map((c) => ({ value: c, label: c })),
    [existingAssetCodes],
  );

  const saveMut = useMutation({
    mutationFn: async (v: AddHoldingOutput) => {
      return createAccountWithOpening({
        account_name: v.account_name,
        asset_code: v.asset_code,
        asset_type: v.asset_type,
        custody_location_id: v.custody_location_id,
        quantity: v.quantity,
        movement_date: v.movement_date,
        notes: v.notes ?? null,
        ortak_movement_type: v.ortak_movement_type ?? null,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: treasuryKeys.all });
      toast.success("Holding created");
      onOpenChange(false);
    },
    onError: (e: Error) =>
      toast.error(e.message ?? "Failed to create holding"),
  });

  const onSubmit = form.handleSubmit((values) => saveMut.mutate(values));

  const requiresOrtak = Boolean(selectedCustody?.requires_movement_type);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add holding</DialogTitle>
          <DialogDescription>
            Creates one account and an opening movement for its starting
            quantity.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <Field
            label="Account name *"
            error={form.formState.errors.account_name?.message}
          >
            <Input
              placeholder="e.g. USD @ Şirket"
              {...form.register("account_name")}
            />
          </Field>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field
              label="Asset code *"
              error={form.formState.errors.asset_code?.message}
            >
              <Controller
                name="asset_code"
                control={form.control}
                render={({ field }) => (
                  <Combobox
                    items={assetItems}
                    value={field.value || null}
                    onChange={(v) => field.onChange(v ?? "")}
                    placeholder="USD, BTC, Altın…"
                    searchPlaceholder="Search or type new…"
                    emptyMessage="No matches — type a new code."
                    createLabel={(q) => `Use "${q}"`}
                    onCreate={(v) => {
                      field.onChange(v);
                    }}
                  />
                )}
              />
            </Field>

            <Field
              label="Asset type *"
              error={form.formState.errors.asset_type?.message}
            >
              <Controller
                name="asset_type"
                control={form.control}
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(v) => field.onChange(v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ASSET_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {ASSET_TYPE_LABELS[t]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
          </div>

          <Field
            label="Custody *"
            error={form.formState.errors.custody_location_id?.message}
          >
            <Controller
              name="custody_location_id"
              control={form.control}
              render={({ field }) => (
                <Combobox
                  items={custodyItems}
                  value={field.value || null}
                  onChange={(v) => field.onChange(v ?? "")}
                  placeholder="Pick a custody"
                  searchPlaceholder="Search custody…"
                  emptyMessage="No active custody locations."
                />
              )}
            />
          </Field>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field
              label="Opening quantity *"
              error={form.formState.errors.quantity?.message}
            >
              <Input
                type="number"
                step="any"
                min="0"
                placeholder="0"
                {...form.register("quantity")}
              />
            </Field>

            <Field
              label="Date *"
              error={form.formState.errors.movement_date?.message}
            >
              <Input type="date" {...form.register("movement_date")} />
            </Field>
          </div>

          {requiresOrtak ? (
            <Field
              label="Ortak movement type *"
              error={form.formState.errors.ortak_movement_type?.message}
            >
              <Controller
                name="ortak_movement_type"
                control={form.control}
                render={({ field }) => (
                  <Select
                    value={field.value ?? ""}
                    onValueChange={(v) =>
                      field.onChange(v === "" ? null : (v as never))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select…" />
                    </SelectTrigger>
                    <SelectContent>
                      {ORTAK_MOVEMENT_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {ORTAK_TYPE_LABELS[t]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
          ) : null}

          <Field label="Notes">
            <Textarea rows={2} {...form.register("notes")} />
          </Field>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saveMut.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saveMut.isPending}>
              {saveMut.isPending ? "Saving…" : "Create holding"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  error,
  children,
  className,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
