"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Controller, useForm, useWatch, type Resolver } from "react-hook-form";
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
  TRANSPORT_METHODS,
  type CustomerSummary,
  type Shipment,
} from "@/lib/supabase/types";

import {
  shipmentFormSchema,
  type ShipmentFormOutput,
  type ShipmentFormValues,
} from "./schema";
import {
  CONTAINER_TYPE_OPTIONS,
  TRANSPORT_METHOD_LABELS,
} from "./constants";
import {
  countShipmentsForCustomer,
  shipmentKeys,
} from "./queries";
import { createShipment, updateShipment } from "./mutations";
import {
  listCustomerContacts,
  orderKeys,
} from "@/features/orders/queries";

function defaultValues(): ShipmentFormValues {
  return {
    customer_id: "",
    name: "",
    tracking_number: null,
    transport_method: null,
    container_type: null,
    vessel_name: null,
    etd_date: null,
    eta_date: null,
    invoice_currency: "USD",
    freight_cost: "",
    freight_currency: null,
    notes: "",
  };
}

function fromShipment(s: Shipment): ShipmentFormValues {
  const invoice = (BALANCE_CURRENCIES as readonly string[]).includes(
    s.invoice_currency,
  )
    ? (s.invoice_currency as ShipmentFormValues["invoice_currency"])
    : "USD";
  const freightCurrency = s.freight_currency &&
    (BALANCE_CURRENCIES as readonly string[]).includes(s.freight_currency)
    ? (s.freight_currency as ShipmentFormValues["freight_currency"])
    : null;
  const transport =
    s.transport_method &&
    (TRANSPORT_METHODS as readonly string[]).includes(s.transport_method)
      ? (s.transport_method as ShipmentFormValues["transport_method"])
      : null;
  return {
    customer_id: s.customer_id,
    name: s.name,
    tracking_number: s.tracking_number,
    transport_method: transport,
    container_type: s.container_type,
    vessel_name: s.vessel_name,
    etd_date: s.etd_date,
    eta_date: s.eta_date,
    invoice_currency: invoice,
    freight_cost: s.freight_cost === null ? "" : String(s.freight_cost),
    freight_currency: freightCurrency,
    notes: s.notes ?? "",
  };
}

export function ShipmentFormDialog({
  open,
  onOpenChange,
  shipment,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  shipment?: Shipment | null;
  onCreated?: (id: string) => void;
}) {
  const qc = useQueryClient();
  const isEdit = Boolean(shipment);
  const freightLocked = isEdit && shipment?.status === "arrived";

  // Lazy-init a stable UUID for new-shipment inserts so the row ID is set
  // before submit (storage uploads need it as a path prefix). Reset on close
  // so reopening for "new" gets a fresh ID.
  const [stableNewId, setStableNewId] = useState(() => crypto.randomUUID());
  const effectiveId = isEdit ? (shipment as Shipment).id : stableNewId;

  const handleOpenChange = (next: boolean) => {
    if (!next && !isEdit) setStableNewId(crypto.randomUUID());
    onOpenChange(next);
  };

  const form = useForm<ShipmentFormValues, unknown, ShipmentFormOutput>({
    resolver: zodResolver(shipmentFormSchema) as unknown as Resolver<
      ShipmentFormValues,
      unknown,
      ShipmentFormOutput
    >,
    defaultValues: defaultValues(),
    mode: "onBlur",
  });

  useEffect(() => {
    if (!open) return;
    if (isEdit && shipment) form.reset(fromShipment(shipment));
    else form.reset(defaultValues());
  }, [open, isEdit, shipment, form]);

  const customersQ = useQuery({
    queryKey: orderKeys.customers(),
    queryFn: listCustomerContacts,
    staleTime: 60_000,
  });
  const customers: CustomerSummary[] = customersQ.data ?? [];

  const customerItems = useMemo(
    () =>
      customers
        .filter((c) => Boolean(c.company_name))
        .map((c) => ({ value: c.id, label: c.company_name as string })),
    [customers],
  );

  const watchCustomer = useWatch({
    control: form.control,
    name: "customer_id",
  });

  const countQ = useQuery({
    queryKey: ["shipments", "count", watchCustomer],
    queryFn: () => countShipmentsForCustomer(watchCustomer),
    enabled: Boolean(watchCustomer) && !isEdit,
  });

  // Default invoice_currency from customer balance_currency. Tracks the
  // customer the auto-set was applied to so switching customer re-runs.
  const autoCurrencyForRef = useRef<string | null>(null);
  useEffect(() => {
    if (isEdit) return;
    if (!watchCustomer) {
      autoCurrencyForRef.current = null;
      return;
    }
    const c = customers.find((x) => x.id === watchCustomer);
    if (autoCurrencyForRef.current !== watchCustomer) {
      if (
        c?.balance_currency &&
        (BALANCE_CURRENCIES as readonly string[]).includes(c.balance_currency)
      ) {
        form.setValue(
          "invoice_currency",
          c.balance_currency as ShipmentFormValues["invoice_currency"],
        );
      }
      autoCurrencyForRef.current = watchCustomer;
    }
    // Set placeholder name once the count for this customer has resolved,
    // otherwise we'd lock in "#1" before the real count arrives.
    if (countQ.isPending) return;
    const currentName = form.getValues("name");
    if (!currentName && c?.company_name) {
      const n = (countQ.data ?? 0) + 1;
      form.setValue("name", `${c.company_name} #${n}`);
    }
  }, [watchCustomer, customers, countQ.data, countQ.isPending, form, isEdit]);

  const saveMut = useMutation({
    mutationFn: async (values: ShipmentFormOutput) => {
      const basePayload = {
        customer_id: values.customer_id,
        name: values.name,
        tracking_number: values.tracking_number,
        transport_method: values.transport_method ?? null,
        container_type: values.container_type,
        vessel_name: values.vessel_name,
        etd_date: values.etd_date,
        eta_date: values.eta_date,
        invoice_currency: values.invoice_currency,
        notes: values.notes && values.notes.trim() ? values.notes : null,
      };
      const payload = freightLocked
        ? basePayload
        : {
            ...basePayload,
            freight_cost: values.freight_cost,
            freight_currency: values.freight_currency ?? null,
          };
      if (isEdit) {
        return updateShipment({
          id: effectiveId,
          payload,
        });
      }
      return createShipment({
        id: effectiveId,
        payload,
      });
    },
    onSuccess: (s) => {
      qc.invalidateQueries({ queryKey: shipmentKeys.all });
      toast.success(isEdit ? "Shipment updated" : "Shipment created");
      if (!isEdit) onCreated?.(s.id);
      handleOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message ?? "Failed"),
  });

  const onSubmit = form.handleSubmit((values) => saveMut.mutate(values));

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit shipment" : "New shipment"}</DialogTitle>
          <DialogDescription>
            Shipments bundle one or more orders for physical and financial
            grouping.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field
              label="Customer *"
              error={form.formState.errors.customer_id?.message}
              className="md:col-span-2"
            >
              <Controller
                name="customer_id"
                control={form.control}
                render={({ field }) => (
                  <Combobox
                    items={customerItems}
                    value={field.value}
                    onChange={(v) => field.onChange(v ?? "")}
                    placeholder="Pick a customer"
                    searchPlaceholder="Search customers…"
                    emptyMessage="No customers found."
                    disabled={isEdit}
                  />
                )}
              />
            </Field>

            <Field
              label="Name *"
              error={form.formState.errors.name?.message}
              className="md:col-span-2"
            >
              <Input
                placeholder="e.g. Mali Buru #3"
                {...form.register("name")}
              />
            </Field>

            <Field label="Transport method">
              <Controller
                name="transport_method"
                control={form.control}
                render={({ field }) => (
                  <Select
                    value={field.value ?? ""}
                    onValueChange={(v) =>
                      field.onChange(
                        v === ""
                          ? null
                          : (v as ShipmentFormValues["transport_method"]),
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      {TRANSPORT_METHODS.map((m) => (
                        <SelectItem key={m} value={m}>
                          {TRANSPORT_METHOD_LABELS[m] ?? m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>

            <Field label="Container type">
              <Input
                list="container-types"
                placeholder="e.g. 40HC"
                {...form.register("container_type")}
              />
              <datalist id="container-types">
                {CONTAINER_TYPE_OPTIONS.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </Field>

            <Field label="Vessel name">
              <Input {...form.register("vessel_name")} />
            </Field>
            <Field label="Tracking number">
              <Input {...form.register("tracking_number")} />
            </Field>

            <Field label="ETD date">
              <Input type="date" {...form.register("etd_date")} />
            </Field>
            <Field label="ETA date">
              <Input type="date" {...form.register("eta_date")} />
            </Field>

            <Field
              label="Invoice currency *"
              error={form.formState.errors.invoice_currency?.message}
            >
              <Controller
                name="invoice_currency"
                control={form.control}
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(v) =>
                      field.onChange(
                        v as ShipmentFormValues["invoice_currency"],
                      )
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
              label="Freight cost"
              error={
                freightLocked
                  ? "Locked: shipment has arrived. Use an adjustment transaction."
                  : undefined
              }
            >
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                disabled={freightLocked}
                title={
                  freightLocked
                    ? "Cannot modify billing amount on arrived shipment."
                    : undefined
                }
                {...form.register("freight_cost")}
              />
            </Field>
            <Field label="Freight currency">
              <Controller
                name="freight_currency"
                control={form.control}
                render={({ field }) => (
                  <Select
                    value={field.value ?? ""}
                    onValueChange={(v) =>
                      field.onChange(
                        v === ""
                          ? null
                          : (v as ShipmentFormValues["freight_currency"]),
                      )
                    }
                    disabled={freightLocked}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="—" />
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

            <Field label="Notes" className="md:col-span-2">
              <Textarea rows={3} {...form.register("notes")} />
            </Field>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={saveMut.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saveMut.isPending}>
              {saveMut.isPending
                ? "Saving…"
                : isEdit
                  ? "Save changes"
                  : "Create shipment"}
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
