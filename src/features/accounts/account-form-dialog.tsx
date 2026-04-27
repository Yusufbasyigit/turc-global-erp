"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Controller,
  useForm,
  useWatch,
  type FieldPath,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
  type AccountWithCustody,
  type AssetType,
  type CustodyLocation,
} from "@/lib/supabase/types";
import {
  listCustodyLocations,
  treasuryKeys,
} from "@/features/treasury/queries";
import { ASSET_TYPE_LABELS } from "@/features/treasury/constants";

import {
  accountFormSchema,
  type AccountFormOutput,
  type AccountFormValues,
} from "./schema";
import { accountKeys, getAccount } from "./queries";
import { createAccount, updateAccount } from "./mutations";

const ASSET_CODE_HELPER: Record<AssetType, string> = {
  fiat: "ISO currency code, e.g. USD, EUR, TRY",
  crypto: "Ticker, e.g. BTC, USDT, AVAX",
  metal: "Asset name, e.g. Altın, Gümüş",
  fund: "TEFAS code, e.g. KTJ, KPU",
};

const DEFAULT_VALUES: AccountFormValues = {
  account_name: "",
  asset_type: "fiat",
  asset_code: "",
  custody_location_id: "",
  bank_name: null,
  iban: null,
  account_type: null,
  subtype: null,
  _custody_location_type: null,
};

type StepId = "basics" | "custody" | "details";

const STEPS: {
  id: StepId;
  title: string;
  description: string;
  fields: FieldPath<AccountFormValues>[];
}[] = [
  {
    id: "basics",
    title: "Basics",
    description: "Name the account and pick the asset.",
    fields: ["account_name", "asset_type", "asset_code"],
  },
  {
    id: "custody",
    title: "Custody",
    description: "Where this account is held.",
    fields: ["custody_location_id"],
  },
  {
    id: "details",
    title: "Details",
    description: "Optional bank or fund details — depends on asset type.",
    fields: ["bank_name", "iban", "account_type", "subtype"],
  },
];

export function AccountFormDialog({
  open,
  onOpenChange,
  accountId,
  existingNames,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string | null;
  // Existing names (active + inactive, excluding deleted) for client-side
  // case-insensitive uniqueness check. The DB partial unique index is the
  // authoritative guard; this just gives a friendly pre-submit error.
  existingNames: { id: string; name: string }[];
}) {
  const isEdit = Boolean(accountId);
  const qc = useQueryClient();
  const [stepIndex, setStepIndex] = useState(0);

  const { data: existing } = useQuery({
    queryKey: accountId ? accountKeys.detail(accountId) : ["account", "new"],
    queryFn: () => getAccount(accountId!),
    enabled: Boolean(accountId) && open,
  });

  const custodyQ = useQuery({
    queryKey: treasuryKeys.custody(),
    queryFn: () => listCustodyLocations({ activeOnly: false }),
    enabled: open,
  });
  const allCustody = useMemo<CustodyLocation[]>(
    () => custodyQ.data ?? [],
    [custodyQ.data],
  );

  const form = useForm<AccountFormValues, unknown, AccountFormOutput>({
    resolver: zodResolver(accountFormSchema),
    defaultValues: DEFAULT_VALUES,
    mode: "onBlur",
  });

  // Reset on open / when existing loads.
  useEffect(() => {
    if (!open) return;
    setStepIndex(0);
    if (isEdit && existing) {
      form.reset({
        account_name: existing.account_name,
        asset_type: (existing.asset_type as AssetType) ?? "fiat",
        asset_code: existing.asset_code ?? "",
        custody_location_id: existing.custody_location_id ?? "",
        bank_name: existing.bank_name,
        iban: existing.iban,
        account_type: existing.account_type,
        subtype: existing.subtype,
        _custody_location_type: null,
      });
    } else if (!isEdit) {
      form.reset(DEFAULT_VALUES);
    }
  }, [open, isEdit, existing, form]);

  // Track the selected custody's location_type so the Zod metal-must-be-physical
  // refinement can run.
  const custodyId = useWatch({
    control: form.control,
    name: "custody_location_id",
  });
  const assetType = useWatch({ control: form.control, name: "asset_type" });

  const selectedCustody = useMemo(
    () => allCustody.find((c) => c.id === custodyId) ?? null,
    [allCustody, custodyId],
  );

  useEffect(() => {
    form.setValue(
      "_custody_location_type",
      selectedCustody
        ? (selectedCustody.location_type as "bank" | "physical")
        : null,
      { shouldValidate: false },
    );
  }, [selectedCustody, form]);

  // Custody picker options: active locations only, but if the loaded record
  // references an inactive custody, prepend it (with `(inactive)` suffix) so
  // the FK isn't silently stripped on save.
  const custodyItems = useMemo(() => {
    const active = allCustody
      .filter((c) => c.is_active !== false)
      .map((c) => ({
        value: c.id,
        label: `${c.name} (${c.location_type})`,
      }));
    const currentId = existing?.custody_location_id ?? custodyId;
    if (
      currentId &&
      !active.some((o) => o.value === currentId)
    ) {
      const orphan = allCustody.find((c) => c.id === currentId);
      if (orphan) {
        return [
          {
            value: orphan.id,
            label: `${orphan.name} (${orphan.location_type}) (inactive)`,
          },
          ...active,
        ];
      }
    }
    return active;
  }, [allCustody, existing, custodyId]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: accountKeys.all });
    qc.invalidateQueries({ queryKey: treasuryKeys.accounts() });
    qc.invalidateQueries({ queryKey: treasuryKeys.all });
  };

  const createMut = useMutation({
    mutationFn: createAccount,
    onSuccess: () => {
      invalidate();
      toast.success("Account created");
      onOpenChange(false);
    },
    onError: (e: Error) =>
      toast.error(e.message ?? "Failed to create account"),
  });

  const updateMut = useMutation({
    mutationFn: (values: AccountFormOutput) =>
      updateAccount(accountId!, values),
    onSuccess: () => {
      invalidate();
      toast.success("Account updated");
      onOpenChange(false);
    },
    onError: (e: Error) =>
      toast.error(e.message ?? "Failed to update account"),
  });

  const submitting = createMut.isPending || updateMut.isPending;

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

  const onSubmit = form.handleSubmit((values) => {
    // Client-side case-insensitive uniqueness against non-deleted names.
    const target = values.account_name.trim().toLowerCase();
    const clash = existingNames.find(
      (a) => a.id !== accountId && a.name.trim().toLowerCase() === target,
    );
    if (clash) {
      form.setError("account_name", {
        type: "manual",
        message: "An account with this name already exists.",
      });
      setStepIndex(0);
      return;
    }
    if (isEdit) updateMut.mutate(values);
    else createMut.mutate(values);
  });

  // Always preventDefault on form submit (typically fired by Enter in an
  // input). On non-final steps Enter advances; on the final step we require an
  // explicit click on the create/save button so users can't trigger the
  // mutation just by pressing Enter while filling fields.
  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isLastStep) void goNext();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit account" : "Add account"}
          </DialogTitle>
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

            {currentStep.id === "basics" ? (
              <div className="space-y-4">
                <Field
                  label="Account name *"
                  error={form.formState.errors.account_name?.message}
                >
                  <Input
                    autoFocus={!isEdit}
                    placeholder="e.g. Şirket İş Bankası EUR"
                    {...form.register("account_name")}
                  />
                </Field>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Field
                    label="Asset type *"
                    error={form.formState.errors.asset_type?.message}
                    hint={isEdit ? "Asset type can't be changed." : undefined}
                  >
                    <Controller
                      name="asset_type"
                      control={form.control}
                      render={({ field }) => (
                        <Select
                          value={field.value}
                          onValueChange={(v) => field.onChange(v as AssetType)}
                          disabled={isEdit}
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

                  <Field
                    label="Asset code *"
                    error={form.formState.errors.asset_code?.message}
                    hint={ASSET_CODE_HELPER[assetType ?? "fiat"]}
                  >
                    <Input
                      placeholder={
                        assetType === "metal" ? "Altın" : "USD"
                      }
                      {...form.register("asset_code")}
                    />
                  </Field>
                </div>
              </div>
            ) : null}

            {currentStep.id === "custody" ? (
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
            ) : null}

            {currentStep.id === "details" ? (
              <div className="space-y-4">
                {assetType === "fiat" ? (
                  <div className="space-y-4 rounded-md border bg-muted/30 p-3">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <Field
                        label="Bank name"
                        error={form.formState.errors.bank_name?.message}
                      >
                        <Input
                          placeholder="e.g. İş Bankası"
                          {...form.register("bank_name")}
                        />
                      </Field>
                      <Field
                        label="Account label"
                        error={form.formState.errors.account_type?.message}
                        hint="e.g. checking, savings"
                      >
                        <Input
                          placeholder="checking"
                          {...form.register("account_type")}
                        />
                      </Field>
                    </div>
                    <Field
                      label="IBAN"
                      error={form.formState.errors.iban?.message}
                      hint="Optional. Spaces are stripped on save."
                    >
                      <Input
                        placeholder="TR00 0000 0000 0000 0000 0000 00"
                        className="font-mono"
                        {...form.register("iban")}
                      />
                    </Field>
                  </div>
                ) : null}

                {assetType === "fund" ? (
                  <Field
                    label="Subtype"
                    error={form.formState.errors.subtype?.message}
                    hint="e.g. money market, equity"
                  >
                    <Input
                      placeholder="money market"
                      {...form.register("subtype")}
                    />
                  </Field>
                ) : null}

                {assetType !== "fiat" && assetType !== "fund" ? (
                  <p className="text-xs text-muted-foreground">
                    No additional details required for{" "}
                    {ASSET_TYPE_LABELS[assetType ?? "fiat"]} accounts. Click
                    &quot;{isEdit ? "Save changes" : "Create account"}&quot; to
                    finish.
                  </p>
                ) : null}
              </div>
            ) : null}
          </section>

          <DialogFooter className="flex-row items-center justify-between gap-2 pt-2 sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              onClick={goBack}
              disabled={stepIndex === 0 || submitting}
            >
              <ArrowLeft className="mr-2 size-4" />
              Back
            </Button>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={submitting}
              >
                Cancel
              </Button>

              {isLastStep ? (
                <Button
                  type="button"
                  disabled={submitting}
                  onClick={() => void onSubmit()}
                >
                  {submitting
                    ? "Saving…"
                    : isEdit
                      ? "Save changes"
                      : "Create account"}
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
  hint,
  children,
  className,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      {!error && hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

// Re-export the AccountWithCustody type used by callers when constructing
// existingNames. (Kept to avoid an unused import warning if a parent imports
// the dialog and the type from here.)
export type { AccountWithCustody };
