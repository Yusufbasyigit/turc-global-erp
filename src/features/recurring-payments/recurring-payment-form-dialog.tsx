"use client";

import { useEffect, useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
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
import { Combobox } from "@/components/ui/combobox";
import { cn } from "@/lib/utils";
import {
  BALANCE_CURRENCIES,
  type BalanceCurrency,
} from "@/lib/supabase/types";
import {
  listAccountsWithCustody,
  treasuryKeys,
} from "@/features/treasury/queries";
import { listContacts, contactKeys } from "@/features/contacts/queries";
import {
  listExpenseTypes,
  transactionKeys,
} from "@/features/transactions/queries";

import {
  recurringPaymentFormSchema,
  type RecurringPaymentFormOutput,
  type RecurringPaymentFormValues,
} from "./schema";
import {
  createRecurringTemplate,
  updateRecurringTemplate,
} from "./mutations";
import {
  recurringPaymentKeys,
  type RecurringPaymentWithRelations,
} from "./queries";

const KIND_OPTIONS: { value: RecurringPaymentFormOutput["kind"]; label: string }[] = [
  { value: "expense", label: "Expense" },
  { value: "other_expense", label: "Other expense" },
  { value: "supplier_payment", label: "Supplier payment" },
  { value: "tax_payment", label: "Tax payment" },
];

function todayLocalIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function firstOfThisMonth(): string {
  return `${todayLocalIso().slice(0, 7)}-01`;
}

const DEFAULT_VALUES: RecurringPaymentFormValues = {
  name: "",
  description: null,
  kind: "expense",
  expected_amount: "" as unknown as number,
  currency: "TRY" as BalanceCurrency,
  day_of_month: 1,
  account_id: "",
  contact_id: null,
  expense_type_id: null,
  effective_from: firstOfThisMonth(),
  end_date: null,
  notes: null,
};

export function RecurringPaymentFormDialog({
  open,
  onOpenChange,
  template,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: RecurringPaymentWithRelations | null;
}) {
  const isEdit = Boolean(template);
  const qc = useQueryClient();

  const accountsQ = useQuery({
    queryKey: treasuryKeys.accounts(),
    queryFn: listAccountsWithCustody,
    enabled: open,
  });
  const contactsQ = useQuery({
    queryKey: contactKeys.list(),
    queryFn: listContacts,
    enabled: open,
  });
  const expenseTypesQ = useQuery({
    queryKey: transactionKeys.expenseTypes(),
    queryFn: listExpenseTypes,
    enabled: open,
  });

  const accountItems = useMemo(
    () =>
      (accountsQ.data ?? []).map((a) => ({
        value: a.id,
        label: `${a.account_name}${a.asset_code ? ` · ${a.asset_code}` : ""}${a.asset_type === "credit_card" ? " (card)" : ""}`,
      })),
    [accountsQ.data],
  );

  const contactItems = useMemo(
    () =>
      (contactsQ.data ?? []).map((c) => ({
        value: c.id,
        label: c.company_name,
      })),
    [contactsQ.data],
  );

  const expenseTypeItems = useMemo(
    () =>
      (expenseTypesQ.data ?? []).map((e) => ({
        value: e.id,
        label: e.name,
      })),
    [expenseTypesQ.data],
  );

  const form = useForm<
    RecurringPaymentFormValues,
    unknown,
    RecurringPaymentFormOutput
  >({
    resolver: zodResolver(recurringPaymentFormSchema),
    defaultValues: DEFAULT_VALUES,
    mode: "onBlur",
  });

  useEffect(() => {
    if (!open) return;
    if (isEdit && template) {
      form.reset({
        name: template.name,
        description: template.description,
        kind: template.kind as RecurringPaymentFormOutput["kind"],
        expected_amount: Number(
          template.expected_amount,
        ) as unknown as number,
        currency: template.currency as BalanceCurrency,
        day_of_month: template.day_of_month,
        account_id: template.account_id,
        contact_id: template.contact_id,
        expense_type_id: template.expense_type_id,
        effective_from: template.effective_from,
        end_date: template.end_date,
        notes: template.notes,
      });
    } else {
      form.reset({ ...DEFAULT_VALUES, effective_from: firstOfThisMonth() });
    }
  }, [open, isEdit, template, form]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: recurringPaymentKeys.all });
  };

  const createMut = useMutation({
    mutationFn: createRecurringTemplate,
    onSuccess: () => {
      invalidate();
      toast.success("Recurring payment added");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message ?? "Failed to add"),
  });

  const updateMut = useMutation({
    mutationFn: (values: RecurringPaymentFormOutput) =>
      updateRecurringTemplate(template!.id, values),
    onSuccess: () => {
      invalidate();
      toast.success("Recurring payment updated");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message ?? "Failed to update"),
  });

  const submitting = createMut.isPending || updateMut.isPending;

  const onSubmit = form.handleSubmit((values) => {
    // Currency must match the source account's asset_code, otherwise
    // mark-paid will fail server-side at assertAccountCurrencyMatches.
    // Catch it pre-submit so the user gets a clear field-level error.
    const account = (accountsQ.data ?? []).find(
      (a) => a.id === values.account_id,
    );
    if (account && account.asset_code && account.asset_code !== values.currency) {
      form.setError("currency", {
        type: "manual",
        message: `Currency must match the account's asset (${account.asset_code}).`,
      });
      return;
    }
    if (isEdit) updateMut.mutate(values);
    else createMut.mutate(values);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit recurring payment" : "New recurring payment"}
          </DialogTitle>
          <DialogDescription>
            A monthly template — paying it each month creates a transaction
            automatically.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <Field
            label="Name *"
            error={form.formState.errors.name?.message}
            hint="e.g. Rent, Sahibinden subscription, Accounting firm"
          >
            <Input
              autoFocus={!isEdit}
              placeholder="Sahibinden subscription"
              {...form.register("name")}
            />
          </Field>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Field
              label="Expected amount *"
              error={form.formState.errors.expected_amount?.message}
              hint="What you usually pay. You can override per month."
            >
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="499"
                {...form.register("expected_amount")}
              />
            </Field>
            <Field
              label="Currency *"
              error={form.formState.errors.currency?.message}
            >
              <Controller
                name="currency"
                control={form.control}
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(v) =>
                      field.onChange(v as BalanceCurrency)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
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
              label="Day of month *"
              error={form.formState.errors.day_of_month?.message}
              hint="Clamps to last day for short months."
            >
              <Input
                type="number"
                min={1}
                max={31}
                {...form.register("day_of_month")}
              />
            </Field>
          </div>

          <Field
            label="Pays from *"
            error={form.formState.errors.account_id?.message}
            hint="Bank account or credit card. Picking a credit card avoids double-counting when you pay the bill."
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
                  searchPlaceholder="Search accounts…"
                  emptyMessage="No active accounts."
                />
              )}
            />
          </Field>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field
              label="Kind"
              error={form.formState.errors.kind?.message}
              hint="What kind of transaction gets created. 'Expense' fits most."
            >
              <Controller
                name="kind"
                control={form.control}
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(v) =>
                      field.onChange(v as RecurringPaymentFormOutput["kind"])
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {KIND_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <Field
              label="Expense type"
              error={form.formState.errors.expense_type_id?.message}
              hint="Optional. Only used when kind is 'Expense'."
            >
              <Controller
                name="expense_type_id"
                control={form.control}
                render={({ field }) => (
                  <Combobox
                    items={expenseTypeItems}
                    value={(field.value as string | null) ?? null}
                    onChange={(v) => field.onChange(v ?? null)}
                    placeholder="None"
                    searchPlaceholder="Search expense types…"
                    emptyMessage="No expense types."
                  />
                )}
              />
            </Field>
          </div>

          <Field
            label="Counterparty"
            error={form.formState.errors.contact_id?.message}
            hint="Optional. Pick a Contact (e.g. landlord, accounting firm)."
          >
            <Controller
              name="contact_id"
              control={form.control}
              render={({ field }) => (
                <Combobox
                  items={contactItems}
                  value={(field.value as string | null) ?? null}
                  onChange={(v) => field.onChange(v ?? null)}
                  placeholder="None"
                  searchPlaceholder="Search contacts…"
                  emptyMessage="No contacts."
                />
              )}
            />
          </Field>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field
              label="Starting from *"
              error={form.formState.errors.effective_from?.message}
              hint="First month this should appear in the checklist."
            >
              <Input type="date" {...form.register("effective_from")} />
            </Field>
            <Field
              label="End date"
              error={form.formState.errors.end_date?.message}
              hint="Optional. Leave blank for open-ended."
            >
              <Input type="date" {...form.register("end_date")} />
            </Field>
          </div>

          <Field
            label="Notes"
            error={form.formState.errors.notes?.message}
          >
            <Textarea
              rows={2}
              placeholder="Anything to remember about this payment"
              {...form.register("notes")}
            />
          </Field>

          <DialogFooter className="gap-2">
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
                  : "Add recurring payment"}
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
