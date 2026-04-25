"use client";

import { useEffect, useRef } from "react";
import { useForm, Controller, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { cn } from "@/lib/utils";
import {
  BALANCE_CURRENCIES,
  CONTACT_TYPES,
  type ContactWithCountry,
} from "@/lib/supabase/types";
import { CONTACT_TYPE_LABELS } from "@/lib/constants";
import {
  contactFormSchema,
  type ContactFormOutput,
  type ContactFormValues,
} from "./schema";
import { countryKeys, listCountries, contactKeys, getContact } from "./queries";
import { createContact, updateContact } from "./mutations";

const DEFAULT_VALUES: ContactFormValues = {
  company_name: "",
  contact_person: "",
  type: "customer",
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

function toFormValues(c: ContactWithCountry): ContactFormValues {
  return {
    company_name: c.company_name ?? "",
    contact_person: c.contact_person ?? "",
    type: (CONTACT_TYPES as readonly string[]).includes(c.type ?? "")
      ? (c.type as ContactFormValues["type"])
      : "other",
    phone: c.phone ?? "",
    email: c.email ?? "",
    address: c.address ?? "",
    city: c.city ?? "",
    country_code: c.country_code ?? "",
    balance_currency:
      (BALANCE_CURRENCIES as readonly string[]).includes(
        c.balance_currency ?? "",
      )
        ? (c.balance_currency as ContactFormValues["balance_currency"])
        : DEFAULT_VALUES.balance_currency,
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

  const { data: countries = [] } = useQuery({
    queryKey: countryKeys.all,
    queryFn: listCountries,
    staleTime: Infinity,
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
      form.reset(DEFAULT_VALUES);
      hasResetRef.current = true;
    } else if (existing) {
      form.reset(toFormValues(existing));
      hasResetRef.current = true;
    }
  }, [open, isEdit, existing, form]);

  const createMut = useMutation({
    mutationFn: createContact,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: contactKeys.all });
      toast.success("Contact created");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message ?? "Failed to create"),
  });

  const updateMut = useMutation({
    mutationFn: (values: ContactFormOutput) => updateContact(contactId!, values),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: contactKeys.all });
      toast.success("Contact updated");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message ?? "Failed to update"),
  });

  const submitting = createMut.isPending || updateMut.isPending;

  const onSubmit = form.handleSubmit((values) => {
    if (isEdit) updateMut.mutate(values);
    else createMut.mutate(values);
  });

  const watchType = useWatch({ control: form.control, name: "type" });
  const watchCountry = useWatch({
    control: form.control,
    name: "country_code",
  });
  const isTurkey = watchCountry === "TR";
  const customerTaxLabel =
    watchType === "customer" ? "Tax ID *" : "Tax ID";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit contact" : "New contact"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the contact's details."
              : "Add a customer, supplier, logistics provider, or other party."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field
              label="Company name *"
              error={form.formState.errors.company_name?.message}
              className="md:col-span-2"
            >
              <Input
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
              label="Type *"
              error={form.formState.errors.type?.message}
            >
              <Controller
                name="type"
                control={form.control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {CONTACT_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {CONTACT_TYPE_LABELS[t]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>

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

            <Field label="Address" className="md:col-span-2">
              <Input placeholder="Street, number" {...form.register("address")} />
            </Field>

            <Field label="City">
              <Input placeholder="Istanbul" {...form.register("city")} />
            </Field>

            <Field
              label="Country"
              error={form.formState.errors.country_code?.message}
            >
              <Controller
                name="country_code"
                control={form.control}
                render={({ field }) => (
                  <Select
                    value={field.value || undefined}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select country" />
                    </SelectTrigger>
                    <SelectContent>
                      {countries.map((c) => (
                        <SelectItem key={c.code} value={c.code}>
                          <span className="mr-2">{c.flag_emoji ?? "🏳️"}</span>
                          {c.name_en}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>

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
              label={customerTaxLabel}
              error={form.formState.errors.tax_id?.message}
            >
              <Input placeholder="1234567890" {...form.register("tax_id")} />
            </Field>

            {isTurkey ? (
              <Field label="Vergi Dairesi (tax office)">
                <Input
                  placeholder="Kadıköy VD"
                  {...form.register("tax_office")}
                />
              </Field>
            ) : null}

            <Field label="Notes" className="md:col-span-2">
              <Textarea
                rows={3}
                placeholder="Static context about this contact (e.g. 'pays late')."
                {...form.register("notes")}
              />
            </Field>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting
                ? "Saving…"
                : isEdit
                  ? "Save changes"
                  : "Create contact"}
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
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : null}
    </div>
  );
}
