"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Controller,
  useForm,
  useWatch,
  type FieldPath,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";

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

type StepId = "asset" | "custody" | "opening";

const STEPS: {
  id: StepId;
  title: string;
  description: string;
  fields: FieldPath<AddHoldingValues>[];
}[] = [
  {
    id: "asset",
    title: "Asset",
    description: "What you're holding and how to label this account.",
    fields: ["account_name", "asset_code", "asset_type"],
  },
  {
    id: "custody",
    title: "Custody",
    description: "Where this asset is held.",
    fields: ["custody_location_id", "ortak_movement_type"],
  },
  {
    id: "opening",
    title: "Opening",
    description: "Starting quantity recorded as the first movement.",
    fields: ["quantity", "movement_date", "notes"],
  },
];

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
  const [stepIndex, setStepIndex] = useState(0);

  const form = useForm<AddHoldingValues, unknown, AddHoldingOutput>({
    resolver: zodResolver(addHoldingSchema),
    defaultValues: DEFAULT_VALUES,
    mode: "onBlur",
  });

  useEffect(() => {
    if (open) {
      form.reset({ ...DEFAULT_VALUES, movement_date: todayDateString() });
      setStepIndex(0);
    }
  }, [open, form]);

  const custodyId = useWatch({
    control: form.control,
    name: "custody_location_id",
  });
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

  const requiresOrtak = Boolean(selectedCustody?.requires_movement_type);
  const isLastStep = stepIndex === STEPS.length - 1;
  const currentStep = STEPS[stepIndex];

  const goNext = async () => {
    const ok = await form.trigger(currentStep.fields);
    if (!ok) return;
    setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
  };
  const goBack = () => setStepIndex((i) => Math.max(i - 1, 0));
  const goTo = async (target: number) => {
    if (target === stepIndex) return;
    if (target < stepIndex) {
      setStepIndex(target);
      return;
    }
    const ok = await form.trigger(currentStep.fields);
    if (!ok) return;
    setStepIndex(target);
  };

  const onSubmit = form.handleSubmit((values) => saveMut.mutate(values));

  // Always preventDefault on form submit (typically fired by Enter in an
  // input). On non-final steps Enter advances; on the final step we require an
  // explicit click on the create button so users can't trigger the mutation
  // just by pressing Enter while filling fields.
  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isLastStep) void goNext();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add holding</DialogTitle>
          <DialogDescription>
            Step {stepIndex + 1} of {STEPS.length} — {currentStep.title}
          </DialogDescription>
        </DialogHeader>

        <Stepper
          steps={STEPS}
          current={stepIndex}
          onPick={(i) => void goTo(i)}
        />

        <form onSubmit={handleFormSubmit} className="space-y-6">
          <section className="space-y-3">
            <div>
              <h3 className="text-sm font-medium">{currentStep.title}</h3>
              <p className="text-xs text-muted-foreground">
                {currentStep.description}
              </p>
            </div>

            {currentStep.id === "asset" ? (
              <div className="space-y-4">
                <Field
                  label="Account name *"
                  error={form.formState.errors.account_name?.message}
                >
                  <Input
                    autoFocus
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
              </div>
            ) : null}

            {currentStep.id === "custody" ? (
              <div className="space-y-4">
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

                {requiresOrtak ? (
                  <Field
                    label="Ortak movement type *"
                    error={
                      form.formState.errors.ortak_movement_type?.message
                    }
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
              </div>
            ) : null}

            {currentStep.id === "opening" ? (
              <div className="space-y-4">
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

                <Field label="Notes">
                  <Textarea rows={3} {...form.register("notes")} />
                </Field>
              </div>
            ) : null}
          </section>

          <DialogFooter className="flex-row items-center justify-between gap-2 pt-2 sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              onClick={goBack}
              disabled={stepIndex === 0 || saveMut.isPending}
            >
              <ArrowLeft className="mr-2 size-4" />
              Back
            </Button>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={saveMut.isPending}
              >
                Cancel
              </Button>

              {isLastStep ? (
                <Button
                  type="button"
                  disabled={saveMut.isPending}
                  onClick={() => void onSubmit()}
                >
                  {saveMut.isPending ? "Saving…" : "Create holding"}
                </Button>
              ) : (
                <Button type="button" onClick={() => void goNext()}>
                  Next
                  <ArrowRight className="ml-2 size-4" />
                </Button>
              )}
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Stepper({
  steps,
  current,
  onPick,
}: {
  steps: { id: StepId; title: string }[];
  current: number;
  onPick: (i: number) => void;
}) {
  return (
    <ol className="flex flex-wrap items-center gap-1 border-y py-3 text-xs">
      {steps.map((s, i) => {
        const state =
          i < current ? "done" : i === current ? "active" : "pending";
        return (
          <li key={s.id} className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onPick(i)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 transition-colors",
                state === "active" &&
                  "border-primary bg-primary text-primary-foreground",
                state === "done" &&
                  "border-border bg-muted text-foreground hover:bg-muted/80",
                state === "pending" &&
                  "border-border text-muted-foreground hover:bg-muted/50",
              )}
              aria-current={state === "active" ? "step" : undefined}
            >
              <span
                className={cn(
                  "flex size-4 items-center justify-center rounded-full text-[10px] font-medium",
                  state === "active" && "bg-primary-foreground/20",
                  state === "done" && "bg-foreground/10",
                  state === "pending" && "bg-muted",
                )}
              >
                {state === "done" ? (
                  <Check className="size-3" />
                ) : (
                  <span>{i + 1}</span>
                )}
              </span>
              <span>{s.title}</span>
            </button>
            {i < steps.length - 1 ? (
              <span className="text-muted-foreground/40">·</span>
            ) : null}
          </li>
        );
      })}
    </ol>
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
