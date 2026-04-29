"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Controller,
  useFieldArray,
  useForm,
  useWatch,
  type FieldPath,
  type Resolver,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  FileText,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";

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
  ACCEPTED_ORDER_ATTACHMENT_TYPES,
  MAX_ORDER_ATTACHMENT_BYTES,
} from "@/lib/constants";
import {
  BALANCE_CURRENCIES,
  KDV_RATES,
  type CustomerSummary,
} from "@/lib/supabase/types";
import { todayDateString } from "@/features/treasury/fx-utils";
import { listProducts, productKeys } from "@/features/products/queries";
import { listSupplierContacts, supplierKeys } from "@/features/products/queries";
import type { ProductWithRelations } from "@/lib/supabase/types";

import {
  orderFormSchema,
  type OrderFormOutput,
  type OrderFormValues,
} from "./schema";
import { createOrder, type CreateOrderLineInput } from "./mutations";
import {
  listCustomerContacts,
  orderKeys,
} from "./queries";

type StepId = "inquiry" | "lines" | "review";

const STEPS: {
  id: StepId;
  title: string;
  description: string;
  fields: FieldPath<OrderFormValues>[];
}[] = [
  {
    id: "inquiry",
    title: "Inquiry",
    description: "Pick the customer, set the date, and add any notes.",
    fields: ["customer_id", "order_date"],
  },
  {
    id: "lines",
    title: "Lines",
    description: "Add the products on this order. Empty is OK at inquiry.",
    fields: ["lines"],
  },
  {
    id: "review",
    title: "Review & submit",
    description: "Attach a customer PO and confirm the order.",
    fields: [],
  },
];

function defaultValues(): OrderFormValues {
  return {
    customer_id: "",
    order_date: todayDateString(),
    order_currency: "USD",
    notes: "",
    lines: [],
  };
}

export function OrderFormDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated?: (orderId: string) => void;
}) {
  const qc = useQueryClient();
  const [stepIndex, setStepIndex] = useState(0);

  // One UUID per dialog session. Reset to null on close so the next open
  // gets a fresh ID; lazily initialized via state so we don't generate a
  // UUID during render.
  const [effectiveOrderId, setEffectiveOrderId] = useState<string | null>(null);

  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setPendingFile(null);
      setStepIndex(0);
      setEffectiveOrderId(null);
    }
    onOpenChange(next);
  };

  const form = useForm<OrderFormValues, unknown, OrderFormOutput>({
    resolver: zodResolver(orderFormSchema) as unknown as Resolver<
      OrderFormValues,
      unknown,
      OrderFormOutput
    >,
    defaultValues: defaultValues(),
    mode: "onBlur",
  });

  useEffect(() => {
    if (open) {
      form.reset(defaultValues());
      setStepIndex(0);
      setPendingFile(null);
      setEffectiveOrderId(crypto.randomUUID());
    }
  }, [open, form]);

  const customersQ = useQuery({
    queryKey: orderKeys.customers(),
    queryFn: listCustomerContacts,
    staleTime: 60_000,
  });
  const productsQ = useQuery({
    queryKey: productKeys.list(),
    queryFn: listProducts,
    staleTime: 60_000,
  });
  const suppliersQ = useQuery({
    queryKey: supplierKeys.all,
    queryFn: listSupplierContacts,
    staleTime: 60_000,
  });

  const customers: CustomerSummary[] = customersQ.data ?? [];
  const products: ProductWithRelations[] = productsQ.data ?? [];
  const suppliers = suppliersQ.data ?? [];

  const fields = useFieldArray({
    control: form.control,
    name: "lines",
  });

  const watchCustomerId = useWatch({
    control: form.control,
    name: "customer_id",
  });
  const watchLines = useWatch({
    control: form.control,
    name: "lines",
  });
  const watchCurrency = useWatch({
    control: form.control,
    name: "order_currency",
  });

  // Default order_currency from the customer's balance_currency. Only
  // overwrite if the field is empty, still equals the form default, or
  // matches our last auto-set value — i.e., never clobber a user choice
  // (an explicit "USD" pick must survive a subsequent customer switch).
  const lastAutoCurrencyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!watchCustomerId) return;
    const customer = customers.find((c) => c.id === watchCustomerId);
    if (!customer?.balance_currency) return;
    if (
      !(BALANCE_CURRENCIES as readonly string[]).includes(
        customer.balance_currency,
      )
    )
      return;
    const current = form.getValues("order_currency");
    const fieldDirty = form.getFieldState("order_currency").isDirty;
    const userChose = fieldDirty && current !== lastAutoCurrencyRef.current;
    if (userChose) return;
    if (current === customer.balance_currency) return;
    form.setValue(
      "order_currency",
      customer.balance_currency as OrderFormValues["order_currency"],
      { shouldDirty: false },
    );
    lastAutoCurrencyRef.current = customer.balance_currency;
  }, [watchCustomerId, customers, form]);

  const customerItems = useMemo(
    () =>
      customers
        .filter((c) => Boolean(c.company_name))
        .map((c) => ({ value: c.id, label: c.company_name as string })),
    [customers],
  );
  const productItems = useMemo(
    () =>
      products
        .filter((p) => Boolean(p.product_name))
        .map((p) => ({
          value: p.product_id,
          label: p.product_name as string,
        })),
    [products],
  );
  const supplierItems = useMemo(
    () =>
      suppliers
        .filter((s) => Boolean(s.company_name))
        .map((s) => ({ value: s.id, label: s.company_name as string })),
    [suppliers],
  );

  // Index of products grouped by their default supplier, so each line's
  // Product picker can show only the chosen supplier's products without
  // re-walking `products` per line. Products with no default_supplier are
  // intentionally excluded — they only show when no supplier filter is set.
  const productItemsBySupplier = useMemo(() => {
    const map = new Map<string, { value: string; label: string }[]>();
    for (const p of products) {
      if (!p.product_name || !p.default_supplier) continue;
      const list = map.get(p.default_supplier) ?? [];
      list.push({ value: p.product_id, label: p.product_name });
      map.set(p.default_supplier, list);
    }
    return map;
  }, [products]);

  // Per-line product items: if the line has a supplier picked, restrict to
  // that supplier's products; if the line's already-selected product isn't
  // in that subset (e.g. user changed the supplier override), prepend it
  // so the Combobox can still render its label.
  const productItemsPerLine = useMemo(() => {
    return (watchLines ?? []).map((l) => {
      const supplierId = l?.supplier_id ?? null;
      const productId = l?.product_id ?? "";
      if (!supplierId) return productItems;
      const filtered = productItemsBySupplier.get(supplierId) ?? [];
      if (productId && !filtered.some((i) => i.value === productId)) {
        const current = productItems.find((i) => i.value === productId);
        if (current) return [current, ...filtered];
      }
      return filtered;
    });
  }, [watchLines, productItems, productItemsBySupplier]);

  const applyProductToLine = (lineIdx: number, productId: string) => {
    const product = products.find((p) => p.product_id === productId);
    if (!product) return;
    form.setValue(`lines.${lineIdx}.product_id`, productId, {
      shouldDirty: true,
    });
    form.setValue(
      `lines.${lineIdx}.product_name_snapshot`,
      product.product_name ?? "",
    );
    form.setValue(
      `lines.${lineIdx}.product_description_snapshot`,
      product.client_description ?? null,
    );
    form.setValue(
      `lines.${lineIdx}.product_photo_snapshot`,
      product.product_image ?? null,
    );
    form.setValue(
      `lines.${lineIdx}.unit_snapshot`,
      product.unit ?? "",
    );
    form.setValue(
      `lines.${lineIdx}.cbm_per_unit_snapshot`,
      product.cbm_per_unit === null ? "" : String(product.cbm_per_unit),
    );
    form.setValue(
      `lines.${lineIdx}.weight_kg_per_unit_snapshot`,
      product.weight_kg_per_unit === null
        ? ""
        : String(product.weight_kg_per_unit),
    );
    form.setValue(
      `lines.${lineIdx}.packaging_type`,
      (product.packaging_type as OrderFormValues["lines"][number]["packaging_type"]) ??
        null,
    );
    form.setValue(
      `lines.${lineIdx}.package_length_cm`,
      product.package_length_cm === null ? "" : String(product.package_length_cm),
    );
    form.setValue(
      `lines.${lineIdx}.package_width_cm`,
      product.package_width_cm === null ? "" : String(product.package_width_cm),
    );
    form.setValue(
      `lines.${lineIdx}.package_height_cm`,
      product.package_height_cm === null ? "" : String(product.package_height_cm),
    );
    form.setValue(
      `lines.${lineIdx}.units_per_package`,
      product.units_per_package === null ? "" : String(product.units_per_package),
    );
    form.setValue(
      `lines.${lineIdx}.supplier_id`,
      product.default_supplier ?? null,
    );
    form.setValue(
      `lines.${lineIdx}.vat_rate`,
      product.kdv_rate,
    );
    form.setValue(
      `lines.${lineIdx}.est_purchase_unit_price`,
      product.est_purchase_price === null
        ? ""
        : String(product.est_purchase_price),
    );
    form.setValue(
      `lines.${lineIdx}.unit_sales_price`,
      product.default_sales_price === null
        ? ""
        : String(product.default_sales_price),
    );
  };

  const addBlankLine = () => {
    fields.append({
      product_id: "",
      quantity: "",
      unit_sales_price: "",
      est_purchase_unit_price: "",
      actual_purchase_price: "",
      vat_rate: null,
      supplier_id: null,
      notes: "",
      product_name_snapshot: "",
      product_description_snapshot: null,
      product_photo_snapshot: null,
      unit_snapshot: "",
      cbm_per_unit_snapshot: "",
      weight_kg_per_unit_snapshot: "",
      packaging_type: null,
      package_length_cm: "",
      package_width_cm: "",
      package_height_cm: "",
      units_per_package: "",
    });
  };

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

  const createMut = useMutation({
    mutationFn: async (values: OrderFormOutput) => {
      const lines: CreateOrderLineInput[] = values.lines.map((l) => ({
        product_id: l.product_id,
        quantity: Number(l.quantity),
        unit_sales_price:
          l.unit_sales_price === null ? null : Number(l.unit_sales_price),
        est_purchase_unit_price:
          l.est_purchase_unit_price === null
            ? null
            : Number(l.est_purchase_unit_price),
        actual_purchase_price:
          l.actual_purchase_price === null
            ? null
            : Number(l.actual_purchase_price),
        vat_rate: l.vat_rate,
        supplier_id: l.supplier_id ?? null,
        notes: l.notes && l.notes.trim() ? l.notes.trim() : null,
        product_name_snapshot: l.product_name_snapshot,
        product_description_snapshot: l.product_description_snapshot ?? null,
        product_photo_snapshot: l.product_photo_snapshot ?? null,
        unit_snapshot: l.unit_snapshot ?? null,
        cbm_per_unit_snapshot:
          l.cbm_per_unit_snapshot === null
            ? null
            : Number(l.cbm_per_unit_snapshot),
        weight_kg_per_unit_snapshot:
          l.weight_kg_per_unit_snapshot === null
            ? null
            : Number(l.weight_kg_per_unit_snapshot),
        packaging_type: l.packaging_type ?? null,
        package_length_cm:
          l.package_length_cm === null ? null : Number(l.package_length_cm),
        package_width_cm:
          l.package_width_cm === null ? null : Number(l.package_width_cm),
        package_height_cm:
          l.package_height_cm === null ? null : Number(l.package_height_cm),
        units_per_package:
          l.units_per_package === null ? null : Number(l.units_per_package),
      }));
      if (!effectiveOrderId) {
        throw new Error("Order ID not initialized");
      }
      return createOrder({
        id: effectiveOrderId,
        payload: {
          customer_id: values.customer_id,
          order_date: values.order_date,
          order_currency: values.order_currency,
          notes: values.notes && values.notes.trim() ? values.notes : null,
        },
        lines,
        pendingFile,
      });
    },
    onSuccess: (order) => {
      qc.invalidateQueries({ queryKey: orderKeys.all });
      toast.success("Order created");
      onCreated?.(order.id);
      handleOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message ?? "Failed to create order"),
  });

  const submitting = createMut.isPending;

  const onSubmit = form.handleSubmit((values) => {
    createMut.mutate(values);
  });

  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    if (!isLastStep) {
      e.preventDefault();
      void goNext();
      return;
    }
    void onSubmit(e);
  };

  const handleFilePick = (file: File) => {
    if (!ACCEPTED_ORDER_ATTACHMENT_TYPES.includes(file.type as never)) {
      toast.error("Unsupported file. Use JPG, PNG, WebP, or PDF.");
      return;
    }
    if (file.size > MAX_ORDER_ATTACHMENT_BYTES) {
      toast.error("File is larger than 5MB.");
      return;
    }
    setPendingFile(file);
  };

  const linesTotal = useMemo(() => {
    const byCurrency = new Map<string, number>();
    for (const line of watchLines ?? []) {
      const qty = Number(line.quantity);
      const price = Number(line.unit_sales_price);
      if (!Number.isFinite(qty) || !Number.isFinite(price)) continue;
      const key = watchCurrency ?? "USD";
      byCurrency.set(key, (byCurrency.get(key) ?? 0) + qty * price);
    }
    return byCurrency;
  }, [watchLines, watchCurrency]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-6xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New order</DialogTitle>
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

            {currentStep.id === "inquiry" ? (
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
                      />
                    )}
                  />
                </Field>

                <Field
                  label="Order date *"
                  error={form.formState.errors.order_date?.message}
                >
                  <Input type="date" {...form.register("order_date")} />
                </Field>

                <Field label="Notes" className="md:col-span-2">
                  <Textarea
                    rows={3}
                    placeholder="Any initial notes about this inquiry…"
                    {...form.register("notes")}
                  />
                </Field>
              </div>
            ) : null}

            {currentStep.id === "lines" ? (
              <div className="space-y-3">
                {fields.fields.length === 0 ? (
                  <div className="rounded-md border border-dashed p-6 text-center text-xs text-muted-foreground">
                    No lines yet. You can leave this empty at inquiry and add
                    lines later.
                  </div>
                ) : null}

                <div className="space-y-3">
                  {fields.fields.map((f, idx) => {
                    const errLine = form.formState.errors.lines?.[idx];
                    return (
                      <div
                        key={f.id}
                        className="rounded-md border bg-muted/20 p-3"
                      >
                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-xs font-medium">
                            Line {idx + 1}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => fields.remove(idx)}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                          <Field
                            label="Product *"
                            error={errLine?.product_id?.message}
                            className="md:col-span-2"
                          >
                            <Controller
                              name={`lines.${idx}.product_id`}
                              control={form.control}
                              render={({ field }) => (
                                <Combobox
                                  items={
                                    productItemsPerLine[idx] ?? productItems
                                  }
                                  value={field.value}
                                  onChange={(v) => {
                                    if (v) applyProductToLine(idx, v);
                                    else field.onChange("");
                                  }}
                                  placeholder="Pick a product"
                                  searchPlaceholder="Search products…"
                                  emptyMessage="No products found."
                                />
                              )}
                            />
                          </Field>

                          <Field
                            label="Quantity *"
                            error={errLine?.quantity?.message}
                          >
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="0"
                              {...form.register(`lines.${idx}.quantity`)}
                            />
                          </Field>

                          <Field label="Unit sales price">
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="0.00"
                              {...form.register(
                                `lines.${idx}.unit_sales_price`,
                              )}
                            />
                          </Field>

                          <Field label="Est. purchase price">
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="0.00"
                              {...form.register(
                                `lines.${idx}.est_purchase_unit_price`,
                              )}
                            />
                          </Field>

                          <Field label="VAT rate">
                            <Controller
                              name={`lines.${idx}.vat_rate`}
                              control={form.control}
                              render={({ field }) => (
                                <Select
                                  value={
                                    field.value === null ||
                                    field.value === undefined
                                      ? ""
                                      : String(field.value)
                                  }
                                  onValueChange={(v) =>
                                    field.onChange(v === "" ? null : Number(v))
                                  }
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="—" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {KDV_RATES.map((r) => (
                                      <SelectItem key={r} value={String(r)}>
                                        {r}%
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}
                            />
                          </Field>

                          <Field
                            label="Supplier (per-line override)"
                            className="md:col-span-2"
                          >
                            <Controller
                              name={`lines.${idx}.supplier_id`}
                              control={form.control}
                              render={({ field }) => (
                                <Combobox
                                  items={supplierItems}
                                  value={field.value}
                                  onChange={field.onChange}
                                  placeholder="Defaults to product's supplier"
                                  searchPlaceholder="Search suppliers…"
                                  emptyMessage="No suppliers found."
                                />
                              )}
                            />
                          </Field>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addBlankLine}
                >
                  <Plus className="mr-2 size-4" /> Add line
                </Button>
              </div>
            ) : null}



            {currentStep.id === "review" ? (
              <div className="space-y-5">
                <div className="space-y-3 rounded-md border p-4 text-sm">
                  <div className="grid grid-cols-2 gap-2">
                    <span className="text-muted-foreground">Customer</span>
                    <span>
                      {customers.find((c) => c.id === watchCustomerId)
                        ?.company_name ?? "—"}
                    </span>
                    <span className="text-muted-foreground">Date</span>
                    <span>{form.getValues("order_date")}</span>
                    <span className="text-muted-foreground">Lines</span>
                    <span>{watchLines?.length ?? 0}</span>
                  </div>
                  {form.getValues("notes")?.trim() ? (
                    <div className="border-t pt-2 text-xs">
                      <div className="text-muted-foreground">Notes</div>
                      <p className="mt-0.5 whitespace-pre-wrap">{form.getValues("notes")}</p>
                    </div>
                  ) : null}
                  {linesTotal.size > 0 ? (
                    <div className="border-t pt-2 text-xs">
                      <div className="text-muted-foreground">Totals</div>
                      {Array.from(linesTotal.entries()).map(([cur, tot]) => (
                        <div key={cur} className="font-medium">
                          {tot.toLocaleString(undefined, {
                            maximumFractionDigits: 2,
                          })}{" "}
                          {cur}
                        </div>
                      ))}
                    </div>
                  ) : null}
                  <p className="text-xs text-muted-foreground">
                    Order will be saved as <span className="font-medium">Inquiry</span>.
                  </p>
                </div>

                <Field label="Customer PO (optional)">
                  <div className="flex flex-col gap-2">
                    {pendingFile ? (
                      <div className="flex items-center gap-3 rounded-md border p-2 text-xs">
                        <FileText className="size-4 text-muted-foreground" />
                        <span className="font-medium">{pendingFile.name}</span>
                        <button
                          type="button"
                          onClick={() => setPendingFile(null)}
                          className="ml-auto inline-flex items-center gap-1 text-destructive"
                        >
                          <Trash2 className="size-3" /> Remove
                        </button>
                      </div>
                    ) : null}
                    <label className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-xs hover:bg-muted/50">
                      <Upload className="size-3.5" />
                      <span>{pendingFile ? "Replace file" : "Choose file"}</span>
                      <input
                        type="file"
                        className="hidden"
                        accept={ACCEPTED_ORDER_ATTACHMENT_TYPES.join(",")}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleFilePick(f);
                          e.currentTarget.value = "";
                        }}
                      />
                    </label>
                  </div>
                </Field>
              </div>
            ) : null}
          </section>

          <DialogFooter className="flex items-center justify-between gap-2">
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
                onClick={() => handleOpenChange(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              {isLastStep ? (
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Saving…" : "Create order"}
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
