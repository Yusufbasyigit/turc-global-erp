"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  useForm,
  Controller,
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Combobox, type ComboboxItem } from "@/components/ui/combobox";
import { cn } from "@/lib/utils";
import {
  BALANCE_CURRENCIES,
  CONTACT_ROLES,
  rolesOf,
  type ContactWithCountry,
  type ContactRole,
} from "@/lib/supabase/types";
import { CONTACT_ROLE_LABELS } from "@/lib/constants";
import {
  contactFormSchema,
  type ContactFormOutput,
  type ContactFormValues,
} from "./schema";
import {
  countryKeys,
  listCountries,
  contactKeys,
  getContact,
  listContacts,
} from "./queries";
import { createContact, updateContact } from "./mutations";
import { orderKeys } from "@/features/orders/queries";
import { shipmentKeys } from "@/features/shipments/queries";
import { transactionKeys } from "@/features/transactions/queries";
import { productKeys } from "@/features/products/queries";

const DEFAULT_VALUES: ContactFormValues = {
  company_name: "",
  contact_person: "",
  roles: ["customer"],
  phone: "",
  email: "",
  address: "",
  city: "",
  country_code: "",
  balance_currency: "USD",
  tax_id: "",
  tax_office: "",
  notes: "",
};

type StepId = "identity" | "contact" | "address" | "finance";

const STEPS: {
  id: StepId;
  title: string;
  description: string;
  fields: FieldPath<ContactFormValues>[];
}[] = [
  {
    id: "identity",
    title: "Identity",
    description: "Who this contact is.",
    fields: ["company_name", "contact_person", "roles"],
  },
  {
    id: "contact",
    title: "Contact",
    description: "How to reach them.",
    fields: ["phone", "email"],
  },
  {
    id: "address",
    title: "Address",
    description: "Where they are based.",
    fields: ["address", "city", "country_code"],
  },
  {
    id: "finance",
    title: "Finance & notes",
    description: "Currency, tax details, and any free-form notes.",
    fields: ["balance_currency", "tax_id", "tax_office", "notes"],
  },
];

function toFormValues(c: ContactWithCountry): ContactFormValues {
  const existingRoles = rolesOf(c);
  return {
    company_name: c.company_name ?? "",
    contact_person: c.contact_person ?? "",
    roles: existingRoles.length > 0 ? existingRoles : ["other"],
    phone: c.phone ?? "",
    email: c.email ?? "",
    address: c.address ?? "",
    city: c.city ?? "",
    country_code: c.country_code ?? "",
    balance_currency:
      c.balance_currency &&
      (BALANCE_CURRENCIES as readonly string[]).includes(c.balance_currency)
        ? (c.balance_currency as ContactFormValues["balance_currency"])
        : "",
    tax_id: c.tax_id ?? "",
    tax_office: c.tax_office ?? "",
    notes: c.notes ?? "",
  };
}

export function ContactFormDialog({
  open,
  onOpenChange,
  contactId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactId?: string | null;
}) {
  const isEdit = Boolean(contactId);
  const qc = useQueryClient();
  const [stepIndex, setStepIndex] = useState(0);

  const { data: countries = [] } = useQuery({
    queryKey: countryKeys.all,
    queryFn: listCountries,
    staleTime: Infinity,
  });

  const { data: allContacts = [] } = useQuery({
    queryKey: contactKeys.list(),
    queryFn: listContacts,
    staleTime: 60_000,
    enabled: open,
  });

  const { data: existing } = useQuery({
    queryKey: contactId ? contactKeys.detail(contactId) : ["contact", "new"],
    queryFn: () => getContact(contactId!),
    enabled: Boolean(contactId) && open,
  });

  const form = useForm<ContactFormValues, unknown, ContactFormOutput>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: DEFAULT_VALUES,
    mode: "onBlur",
  });

  // Reset once per dialog session: on open for new, or once `existing` first
  // arrives for edit. A subsequent refetch of `existing` must not overwrite
  // edits the user has already typed.
  const hasResetRef = useRef(false);
  useEffect(() => {
    if (!open) {
      hasResetRef.current = false;
      return;
    }
    if (hasResetRef.current) return;
    if (!isEdit) {
      setStepIndex(0);
      form.reset(DEFAULT_VALUES);
      hasResetRef.current = true;
    } else if (existing) {
      setStepIndex(0);
      form.reset(toFormValues(existing));
      hasResetRef.current = true;
    }
  }, [open, isEdit, existing, form]);

  // Belt-and-braces: regardless of the form-reset gate, every time the dialog
  // opens we want to land on step 1. Without this, a previous in-flight open
  // that closed before form.reset finished can leave stepIndex stuck at the
  // last visited step, surfacing as "Add contact reopens to step 4".
  useEffect(() => {
    if (open) setStepIndex(0);
  }, [open]);

  // Orders / shipments / transactions / products lists JOIN contacts (for
  // company_name display, role-flag-filtered pickers, etc.). Editing a
  // contact's name or roles must invalidate those caches too, otherwise the
  // lists show stale joined data until the next focus refetch.
  const invalidateContactDependents = () => {
    qc.invalidateQueries({ queryKey: contactKeys.all });
    qc.invalidateQueries({ queryKey: orderKeys.all });
    qc.invalidateQueries({ queryKey: shipmentKeys.all });
    qc.invalidateQueries({ queryKey: transactionKeys.all });
    qc.invalidateQueries({ queryKey: productKeys.all });
  };

  const createMut = useMutation({
    mutationFn: createContact,
    onSuccess: () => {
      invalidateContactDependents();
      toast.success("Contact created");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message ?? "Failed to create"),
  });

  const updateMut = useMutation({
    mutationFn: (values: ContactFormOutput) => updateContact(contactId!, values),
    onSuccess: () => {
      invalidateContactDependents();
      toast.success("Contact updated");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message ?? "Failed to update"),
  });

  const submitting = createMut.isPending || updateMut.isPending;

  const onSubmit = form.handleSubmit(
    (values) => {
      if (isEdit) updateMut.mutate(values);
      else createMut.mutate(values);
    },
    (errors) => {
      const firstStep = STEPS.findIndex((s) =>
        s.fields.some((f) => errors[f as keyof typeof errors]),
      );
      if (firstStep !== -1 && firstStep !== stepIndex) setStepIndex(firstStep);
      toast.error("Please fix the highlighted fields.");
    },
  );

  const watchCountry = useWatch({
    control: form.control,
    name: "country_code",
  });
  const isTurkey = watchCountry === "TR";

  const watchCity = useWatch({ control: form.control, name: "city" });

  const cityOptions: ComboboxItem[] = useMemo(() => {
    const sorted = [...allContacts].sort((a, b) => {
      const ta = a.edited_time ?? a.created_time ?? "";
      const tb = b.edited_time ?? b.created_time ?? "";
      return tb.localeCompare(ta);
    });

    const seen = new Map<string, string>();
    for (const c of sorted) {
      const raw = c.city?.trim();
      if (!raw) continue;
      if (watchCountry && c.country_code !== watchCountry) continue;
      const key = raw.toLowerCase();
      if (!seen.has(key)) seen.set(key, raw);
    }

    const current = watchCity?.trim();
    if (current) {
      const key = current.toLowerCase();
      if (!seen.has(key)) seen.set(key, current);
    }

    return Array.from(seen.values())
      .sort((a, b) => a.localeCompare(b))
      .map((name) => ({ value: name, label: name }));
  }, [allContacts, watchCountry, watchCity]);

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
    for (let i = stepIndex; i < target; i++) {
      const ok = await form.trigger(STEPS[i].fields);
      if (!ok) {
        setStepIndex(i);
        return;
      }
    }
    setStepIndex(target);
  };

  // Always preventDefault on form submit (typically fired by Enter in an
  // input). On non-final steps Enter advances; on the final step we require an
  // explicit click on "Create contact" / "Save changes" so users can't trigger
  // the mutation just by pressing Enter while filling fields.
  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isLastStep) void goNext();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit contact" : "New contact"}</DialogTitle>
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

            {currentStep.id === "identity" ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field
                  label="Company name *"
                  error={form.formState.errors.company_name?.message}
                  className="md:col-span-2"
                >
                  <Input
                    autoFocus={!isEdit}
                    placeholder="Acme Export Ltd."
                    {...form.register("company_name")}
                  />
                </Field>

                <Field label="Contact person">
                  <Input
                    placeholder="Jane Doe"
                    {...form.register("contact_person")}
                  />
                </Field>

                <Field
                  label="Roles * (pick one or more)"
                  error={form.formState.errors.roles?.message}
                  className="md:col-span-2"
                >
                  <Controller
                    name="roles"
                    control={form.control}
                    render={({ field }) => (
                      <RolePicker
                        value={field.value ?? []}
                        onChange={field.onChange}
                      />
                    )}
                  />
                </Field>
              </div>
            ) : null}

            {currentStep.id === "contact" ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field
                  label="Phone"
                  error={form.formState.errors.phone?.message}
                >
                  <Input placeholder="+90…" {...form.register("phone")} />
                </Field>

                <Field
                  label="Email"
                  error={form.formState.errors.email?.message}
                >
                  <Input
                    type="email"
                    placeholder="contact@example.com"
                    {...form.register("email")}
                  />
                </Field>
              </div>
            ) : null}

            {currentStep.id === "address" ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field label="Address" className="md:col-span-2">
                  <Input
                    placeholder="Street, number"
                    {...form.register("address")}
                  />
                </Field>

                <Field label="City">
                  <Controller
                    name="city"
                    control={form.control}
                    render={({ field }) => (
                      <Combobox
                        items={cityOptions}
                        value={field.value || null}
                        onChange={(v) => field.onChange(v ?? "")}
                        onCreate={(label) => field.onChange(label)}
                        createLabel={(q) => `Use "${q}"`}
                        placeholder="Istanbul"
                        searchPlaceholder="Search city…"
                        emptyMessage="No matching city — type to add one."
                      />
                    )}
                  />
                </Field>

                <Field
                  label="Country"
                  error={form.formState.errors.country_code?.message}
                >
                  <Controller
                    name="country_code"
                    control={form.control}
                    render={({ field }) => (
                      <Combobox
                        items={countries.map((c) => ({
                          value: c.code,
                          label: `${c.flag_emoji ?? "🏳️"} ${c.name_en}`,
                        }))}
                        value={field.value}
                        onChange={(v) => field.onChange(v ?? "")}
                        placeholder="Select country"
                        searchPlaceholder="Search country…"
                        emptyMessage="No country found."
                      />
                    )}
                  />
                </Field>
              </div>
            ) : null}

            {currentStep.id === "finance" ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field label="Balance currency">
                  <Controller
                    name="balance_currency"
                    control={form.control}
                    render={({ field }) => (
                      <Select
                        value={field.value || undefined}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select currency" />
                        </SelectTrigger>
                        <SelectContent>
                          {BALANCE_CURRENCIES.map((c) => (
                            <SelectItem key={c} value={c}>
                              {c}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </Field>

                <Field
                  label="Tax ID"
                  error={form.formState.errors.tax_id?.message}
                >
                  <Input
                    placeholder="1234567890"
                    {...form.register("tax_id")}
                  />
                </Field>

                {isTurkey ? (
                  <Field
                    label="Vergi Dairesi (tax office)"
                    className="md:col-span-2"
                  >
                    <Input
                      placeholder="Kadıköy VD"
                      {...form.register("tax_office")}
                    />
                  </Field>
                ) : null}

                <Field label="Notes" className="md:col-span-2">
                  <Textarea
                    rows={4}
                    placeholder="Static context about this contact (e.g. 'pays late')."
                    {...form.register("notes")}
                  />
                </Field>
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
                      : "Create contact"}
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

function RolePicker({
  value,
  onChange,
}: {
  value: ContactRole[];
  onChange: (next: ContactRole[]) => void;
}) {
  const selected = new Set(value);
  const toggle = (role: ContactRole) => {
    const next = new Set(selected);
    if (next.has(role)) next.delete(role);
    else next.add(role);
    // Preserve canonical order from CONTACT_ROLES.
    onChange(CONTACT_ROLES.filter((r) => next.has(r)));
  };
  return (
    <div className="flex flex-wrap gap-2">
      {CONTACT_ROLES.map((role) => {
        const active = selected.has(role);
        return (
          <button
            key={role}
            type="button"
            onClick={() => toggle(role)}
            aria-pressed={active}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors",
              active
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-foreground hover:bg-muted/50",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "flex size-3.5 items-center justify-center rounded-full text-[10px]",
                active ? "bg-primary-foreground/20" : "bg-muted",
              )}
            >
              {active ? <Check className="size-2.5" /> : null}
            </span>
            {CONTACT_ROLE_LABELS[role]}
          </button>
        );
      })}
    </div>
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
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : null}
    </div>
  );
}
