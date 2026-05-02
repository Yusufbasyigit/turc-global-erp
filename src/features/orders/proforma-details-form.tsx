"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Combobox, type ComboboxItem } from "@/components/ui/combobox";
import { cn } from "@/lib/utils";

import {
  proformaFormSchema,
  type ProformaFormOutput,
  type ProformaFormValues,
} from "@/lib/proforma/schema";
import {
  INCOTERM_OPTIONS,
  DEFAULT_INCOTERM,
} from "@/lib/proforma/incoterm-options";
import {
  PAYMENT_TERMS_OPTIONS,
  DEFAULT_PAYMENT_TERMS,
} from "@/lib/proforma/payment-terms-options";
import { todayIsoDate, addDaysIso } from "@/lib/proforma/istanbul-date";
import { updateOrderProformaMetadata } from "./mutations";
import { orderKeys } from "./queries";

type OrderProformaFields = {
  id: string;
  order_currency: string;
  offer_number: string | null;
  offer_date: string | null;
  offer_valid_until: string | null;
  incoterm: string | null;
  delivery_timeline: string | null;
  payment_terms: string | null;
  proforma_notes_remark: string | null;
  proforma_notes_validity: string | null;
  proforma_notes_delivery_location: string | null;
  proforma_notes_production_time: string | null;
  proforma_notes_length_tolerance: string | null;
  proforma_notes_total_weight: string | null;
};

function toFormValues(
  o: OrderProformaFields,
  defaults: { remark: string },
): ProformaFormValues {
  const today = todayIsoDate();
  return {
    offer_date: o.offer_date ?? today,
    offer_valid_until: o.offer_valid_until ?? addDaysIso(today, 30),
    incoterm: o.incoterm ?? DEFAULT_INCOTERM,
    delivery_timeline: o.delivery_timeline ?? "TBD",
    payment_terms: o.payment_terms ?? DEFAULT_PAYMENT_TERMS,
    proforma_notes_remark: o.proforma_notes_remark ?? defaults.remark,
    proforma_notes_validity: o.proforma_notes_validity ?? "",
    proforma_notes_delivery_location:
      o.proforma_notes_delivery_location ?? "",
    proforma_notes_production_time: o.proforma_notes_production_time ?? "",
    proforma_notes_length_tolerance: o.proforma_notes_length_tolerance ?? "",
    proforma_notes_total_weight: o.proforma_notes_total_weight ?? "",
  };
}

function toItems(opts: readonly string[]): ComboboxItem[] {
  return opts.map((v) => ({ value: v, label: v }));
}

export function ProformaDetailsForm({
  order,
}: {
  order: OrderProformaFields;
}) {
  const qc = useQueryClient();
  const defaultRemark = useMemo(
    () =>
      `This offer is denominated in ${order.order_currency}. VAT: 0% (export).`,
    [order.order_currency],
  );

  const [incotermItems, setIncotermItems] = useState<ComboboxItem[]>(() =>
    toItems(INCOTERM_OPTIONS),
  );
  const [paymentItems, setPaymentItems] = useState<ComboboxItem[]>(() =>
    toItems(PAYMENT_TERMS_OPTIONS),
  );

  const form = useForm<ProformaFormValues, unknown, ProformaFormOutput>({
    resolver: zodResolver(proformaFormSchema),
    defaultValues: toFormValues(order, { remark: defaultRemark }),
    mode: "onBlur",
  });

  // Re-seed the form only when the editing target changes (order.id).
  // Using `order` itself in deps would re-reset on every background refetch
  // from React Query, blowing away the user's in-progress edits.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    form.reset(toFormValues(order, { remark: defaultRemark }));
  }, [order.id]);

  const saveMut = useMutation({
    mutationFn: (values: ProformaFormOutput) =>
      updateOrderProformaMetadata({ order_id: order.id, payload: values }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: orderKeys.detail(order.id) });
      qc.invalidateQueries({ queryKey: orderKeys.list() });
      toast.success("Proforma details saved");
    },
    onError: (e: Error) => toast.error(e.message ?? "Failed to save"),
  });

  const onSubmit = form.handleSubmit((values) => saveMut.mutate(values));

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Field label="Offer number">
          <Input
            value={order.offer_number ?? "— (auto on save)"}
            readOnly
            className="bg-muted/40 font-mono text-xs"
          />
        </Field>
        <Field label="Offer date *">
          <Input type="date" {...form.register("offer_date")} />
        </Field>
        <Field label="Offer valid until">
          <Input type="date" {...form.register("offer_valid_until")} />
        </Field>
        <Field label="Incoterm *">
          <Controller
            name="incoterm"
            control={form.control}
            render={({ field }) => (
              <Combobox
                items={incotermItems}
                value={field.value ?? null}
                onChange={(v) => field.onChange(v ?? "")}
                onCreate={async (label) => {
                  setIncotermItems((prev) => [
                    ...prev,
                    { value: label, label },
                  ]);
                  field.onChange(label);
                }}
                placeholder="Select…"
              />
            )}
          />
        </Field>
        <Field label="Delivery timeline">
          <Input
            placeholder="e.g. 4-6 weeks"
            {...form.register("delivery_timeline")}
          />
        </Field>
        <Field label="Payment terms *">
          <Controller
            name="payment_terms"
            control={form.control}
            render={({ field }) => (
              <Combobox
                items={paymentItems}
                value={field.value ?? null}
                onChange={(v) => field.onChange(v ?? "")}
                onCreate={async (label) => {
                  setPaymentItems((prev) => [
                    ...prev,
                    { value: label, label },
                  ]);
                  field.onChange(label);
                }}
                placeholder="Select…"
              />
            )}
          />
        </Field>
      </div>

      <div className="space-y-3 border-t pt-3">
        <div className="text-xs font-medium text-muted-foreground">
          Notes / Conditions
        </div>
        <Field label="Remark">
          <Textarea rows={2} {...form.register("proforma_notes_remark")} />
        </Field>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Field label="Offer validity">
            <Input {...form.register("proforma_notes_validity")} />
          </Field>
          <Field label="Delivery location">
            <Input
              {...form.register("proforma_notes_delivery_location")}
            />
          </Field>
          <Field label="Production time">
            <Input {...form.register("proforma_notes_production_time")} />
          </Field>
          <Field label="Length tolerance">
            <Input {...form.register("proforma_notes_length_tolerance")} />
          </Field>
          <Field label="Total weight" className="md:col-span-2">
            <Input {...form.register("proforma_notes_total_weight")} />
          </Field>
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={saveMut.isPending}>
          {saveMut.isPending ? "Saving…" : "Save proforma details"}
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
