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
  MOVEMENT_KINDS,
  ORTAK_MOVEMENT_TYPES,
  type AccountWithCustody,
  type MovementKind,
} from "@/lib/supabase/types";

import {
  movementSchema,
  type MovementOutput,
} from "./schema";
import {
  createPairedMovement,
  createSingleLegMovement,
} from "./mutations";
import { treasuryKeys } from "./queries";
import { todayDateString } from "./fx-utils";
import {
  MOVEMENT_KIND_DESCRIPTIONS,
  MOVEMENT_KIND_LABELS,
  ORTAK_TYPE_LABELS,
  PAIRED_KINDS,
} from "./constants";

type StepId = "kind" | "accounts" | "details" | "ortak";

const STEPS: { id: StepId; title: string }[] = [
  { id: "kind", title: "Kind" },
  { id: "accounts", title: "Accounts" },
  { id: "details", title: "Details" },
  { id: "ortak", title: "Ortak type" },
];

type MinimalValues = {
  kind: MovementKind;
  account_id: string;
  from_account_id: string;
  to_account_id: string;
  from_asset_code: string;
  to_asset_code: string;
  quantity: number;
  quantity_from: number;
  quantity_to: number;
  movement_date: string;
  notes: string;
  ortak_movement_type: null | (typeof ORTAK_MOVEMENT_TYPES)[number];
  any_leg_requires_movement_type: boolean;
};

const defaultValues = (): MinimalValues => ({
  kind: "deposit",
  account_id: "",
  from_account_id: "",
  to_account_id: "",
  from_asset_code: "",
  to_asset_code: "",
  quantity: "" as unknown as number,
  quantity_from: "" as unknown as number,
  quantity_to: "" as unknown as number,
  movement_date: todayDateString(),
  notes: "",
  ortak_movement_type: null,
  any_leg_requires_movement_type: false,
});

export function RecordMovementDialog({
  open,
  onOpenChange,
  accounts,
  prefillAccountId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  accounts: AccountWithCustody[];
  prefillAccountId?: string;
}) {
  const qc = useQueryClient();
  const [stepIndex, setStepIndex] = useState(0);

  const form = useForm<MinimalValues, unknown, MovementOutput>({
    resolver: zodResolver(movementSchema) as never,
    defaultValues: defaultValues() as never,
    mode: "onBlur",
  });

  useEffect(() => {
    if (open) {
      const base = defaultValues();
      if (prefillAccountId) {
        // Single-leg uses account_id; paired (transfer/trade) uses
        // from_account_id. Default kind is "deposit" (single-leg) so we set
        // both — only the field for the active discriminator gets used.
        base.account_id = prefillAccountId;
        base.from_account_id = prefillAccountId;
      }
      form.reset(base as never);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStepIndex(0);
    }
  }, [open, form, prefillAccountId]);

  const kind = useWatch({ control: form.control, name: "kind" }) as MovementKind;
  const isPaired = PAIRED_KINDS.includes(kind);

  const accountId = useWatch({ control: form.control, name: "account_id" });
  const fromAccountId = useWatch({ control: form.control, name: "from_account_id" });
  const toAccountId = useWatch({ control: form.control, name: "to_account_id" });

  const accountById = useMemo(() => {
    const map = new Map<string, AccountWithCustody>();
    for (const a of accounts) map.set(a.id, a);
    return map;
  }, [accounts]);

  const selectedAccounts = useMemo(() => {
    if (isPaired) {
      const from = fromAccountId ? accountById.get(fromAccountId) : null;
      const to = toAccountId ? accountById.get(toAccountId) : null;
      return [from, to].filter((a): a is AccountWithCustody => Boolean(a));
    }
    const a = accountId ? accountById.get(accountId) : null;
    return a ? [a] : [];
  }, [isPaired, accountId, fromAccountId, toAccountId, accountById]);

  const requiresOrtak = useMemo(
    () =>
      selectedAccounts.some((a) =>
        Boolean(a.custody_locations?.requires_movement_type),
      ),
    [selectedAccounts],
  );

  useEffect(() => {
    form.setValue("any_leg_requires_movement_type", requiresOrtak, {
      shouldValidate: false,
    });
    if (!requiresOrtak) {
      form.setValue("ortak_movement_type", null);
    }
  }, [requiresOrtak, form]);

  useEffect(() => {
    const from = fromAccountId ? accountById.get(fromAccountId) : null;
    const to = toAccountId ? accountById.get(toAccountId) : null;
    form.setValue("from_asset_code", from?.asset_code ?? "");
    form.setValue("to_asset_code", to?.asset_code ?? "");
  }, [fromAccountId, toAccountId, accountById, form]);

  const visibleSteps = useMemo<StepId[]>(() => {
    const base: StepId[] = ["kind", "accounts", "details"];
    if (requiresOrtak) base.push("ortak");
    return base;
  }, [requiresOrtak]);

  const currentStepId = visibleSteps[stepIndex];

  const accountItems = useMemo(
    () =>
      accounts.map((a) => ({
        value: a.id,
        label: `${a.asset_code ?? "?"} @ ${
          a.custody_locations?.name ?? "—"
        } · ${a.account_name}`,
      })),
    [accounts],
  );

  const fieldsForStep = (id: StepId): FieldPath<MinimalValues>[] => {
    if (id === "kind") return ["kind"];
    if (id === "accounts") {
      return isPaired
        ? ["from_account_id", "to_account_id", "from_asset_code", "to_asset_code"]
        : ["account_id"];
    }
    if (id === "details") {
      return isPaired
        ? ["quantity_from", "quantity_to", "movement_date", "notes"]
        : ["quantity", "movement_date", "notes"];
    }
    return ["ortak_movement_type"];
  };

  const goNext = async () => {
    const ok = await form.trigger(fieldsForStep(currentStepId) as never);
    if (!ok) return;
    setStepIndex((i) => Math.min(i + 1, visibleSteps.length - 1));
  };
  const goBack = () => setStepIndex((i) => Math.max(i - 1, 0));

  const saveMut = useMutation({
    mutationFn: async (v: MovementOutput) => {
      if (v.kind === "transfer" || v.kind === "trade") {
        return createPairedMovement({
          kind: v.kind,
          from_account_id: v.from_account_id,
          to_account_id: v.to_account_id,
          quantity_from:
            v.kind === "transfer" ? v.quantity : v.quantity_from,
          quantity_to:
            v.kind === "transfer" ? v.quantity : v.quantity_to,
          movement_date: v.movement_date,
          notes: v.notes ?? null,
          ortak_movement_type: v.ortak_movement_type ?? null,
        });
      }
      return createSingleLegMovement({
        kind: v.kind,
        account_id: v.account_id,
        quantity: v.quantity,
        movement_date: v.movement_date,
        notes: v.notes ?? null,
        ortak_movement_type: v.ortak_movement_type ?? null,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: treasuryKeys.all });
      toast.success("Movement recorded");
      onOpenChange(false);
    },
    onError: (e: Error) =>
      toast.error(e.message ?? "Failed to record movement"),
  });

  const onSubmit = form.handleSubmit((values) => saveMut.mutate(values));

  const isLastStep = stepIndex === visibleSteps.length - 1;

  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    if (!isLastStep) {
      e.preventDefault();
      void goNext();
      return;
    }
    void onSubmit(e);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Record movement</DialogTitle>
          <DialogDescription>
            Step {stepIndex + 1} of {visibleSteps.length} ·{" "}
            {STEPS.find((s) => s.id === currentStepId)?.title}
          </DialogDescription>
        </DialogHeader>

        <Stepper
          steps={visibleSteps.map(
            (id) => STEPS.find((s) => s.id === id) ?? { id, title: id },
          )}
          current={stepIndex}
        />

        <form onSubmit={handleFormSubmit} className="space-y-5">
          {currentStepId === "kind" ? (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {MOVEMENT_KINDS.map((k) => (
                <button
                  type="button"
                  key={k}
                  onClick={() => {
                    form.setValue("kind", k, { shouldValidate: false });
                  }}
                  className={cn(
                    "rounded-lg border p-3 text-left transition-colors",
                    kind === k
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted/50",
                  )}
                >
                  <div className="text-sm font-medium">
                    {MOVEMENT_KIND_LABELS[k]}
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {MOVEMENT_KIND_DESCRIPTIONS[k]}
                  </div>
                </button>
              ))}
            </div>
          ) : null}

          {currentStepId === "accounts" ? (
            <div className="grid grid-cols-1 gap-4">
              {!isPaired ? (
                <Field
                  label="Account *"
                  error={form.formState.errors.account_id?.message as string | undefined}
                >
                  <Controller
                    name="account_id"
                    control={form.control}
                    render={({ field }) => (
                      <Combobox
                        items={accountItems}
                        value={field.value || null}
                        onChange={(v) => field.onChange(v ?? "")}
                        placeholder="Pick an account"
                        searchPlaceholder="Search…"
                        emptyMessage="No accounts yet."
                      />
                    )}
                  />
                </Field>
              ) : (
                <>
                  <Field
                    label="From *"
                    error={
                      form.formState.errors.from_account_id?.message as
                        | string
                        | undefined
                    }
                  >
                    <Controller
                      name="from_account_id"
                      control={form.control}
                      render={({ field }) => (
                        <Combobox
                          items={accountItems}
                          value={field.value || null}
                          onChange={(v) => field.onChange(v ?? "")}
                          placeholder="Source account"
                          searchPlaceholder="Search…"
                          emptyMessage="No accounts yet."
                        />
                      )}
                    />
                  </Field>
                  <Field
                    label="To *"
                    error={
                      form.formState.errors.to_account_id?.message as
                        | string
                        | undefined
                    }
                  >
                    <Controller
                      name="to_account_id"
                      control={form.control}
                      render={({ field }) => (
                        <Combobox
                          items={accountItems}
                          value={field.value || null}
                          onChange={(v) => field.onChange(v ?? "")}
                          placeholder="Destination account"
                          searchPlaceholder="Search…"
                          emptyMessage="No accounts yet."
                        />
                      )}
                    />
                  </Field>
                  {kind === "transfer" ? (
                    <p className="text-xs text-muted-foreground">
                      Transfer requires the same asset on both sides.
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Trade converts between two different assets.
                    </p>
                  )}
                </>
              )}
            </div>
          ) : null}

          {currentStepId === "details" ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {kind === "trade" ? (
                <>
                  <Field
                    label="Source quantity *"
                    error={
                      form.formState.errors.quantity_from?.message as
                        | string
                        | undefined
                    }
                  >
                    <Input
                      type="number"
                      step="any"
                      min="0"
                      placeholder="e.g. 5000"
                      {...form.register("quantity_from")}
                    />
                  </Field>
                  <Field
                    label="Destination quantity *"
                    error={
                      form.formState.errors.quantity_to?.message as
                        | string
                        | undefined
                    }
                  >
                    <Input
                      type="number"
                      step="any"
                      min="0"
                      placeholder="e.g. 50"
                      {...form.register("quantity_to")}
                    />
                  </Field>
                </>
              ) : (
                <Field
                  label="Quantity *"
                  error={
                    form.formState.errors.quantity?.message as
                      | string
                      | undefined
                  }
                  className="md:col-span-2"
                >
                  <Input
                    type="number"
                    step="any"
                    placeholder={
                      kind === "adjustment" ? "+10 or -10" : "0"
                    }
                    {...form.register("quantity")}
                  />
                  {kind === "adjustment" ? (
                    <p className="text-xs text-muted-foreground">
                      Sign is taken as entered. Use a negative number to
                      reduce the holding.
                    </p>
                  ) : null}
                </Field>
              )}

              <Field
                label="Date *"
                error={form.formState.errors.movement_date?.message}
              >
                <Input type="date" {...form.register("movement_date")} />
              </Field>

              <Field label="Notes" className="md:col-span-2">
                <Textarea rows={2} {...form.register("notes")} />
              </Field>
            </div>
          ) : null}

          {currentStepId === "ortak" ? (
            <Field
              label="Ortak movement type *"
              error={
                form.formState.errors.ortak_movement_type?.message as
                  | string
                  | undefined
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
              <p className="text-xs text-muted-foreground">
                Required because an Ortak account is involved.
              </p>
            </Field>
          ) : null}

          <DialogFooter className="flex-row items-center justify-between gap-2 sm:justify-between">
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
                <Button type="submit" disabled={saveMut.isPending}>
                  {saveMut.isPending ? "Saving…" : "Record movement"}
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
}: {
  steps: { id: string; title: string }[];
  current: number;
}) {
  return (
    <ol className="flex flex-wrap items-center gap-1 border-y py-3 text-xs">
      {steps.map((s, i) => {
        const state =
          i < current ? "done" : i === current ? "active" : "pending";
        return (
          <li key={s.id} className="flex items-center gap-1">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1",
                state === "active" &&
                  "border-primary bg-primary text-primary-foreground",
                state === "done" && "border-border bg-muted text-foreground",
                state === "pending" &&
                  "border-border text-muted-foreground",
              )}
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
            </span>
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
