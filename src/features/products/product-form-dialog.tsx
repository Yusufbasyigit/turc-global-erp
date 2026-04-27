"use client";

import { useEffect, useMemo, useState } from "react";
import {
  useForm,
  Controller,
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
  Image as ImageIcon,
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
  ACCEPTED_PRODUCT_IMAGE_TYPES,
  MAX_PRODUCT_IMAGE_BYTES,
  PACKAGING_TYPE_LABELS,
} from "@/lib/constants";
import {
  BALANCE_CURRENCIES,
  KDV_RATES,
  PACKAGING_TYPES,
  type ProductWithRelations,
} from "@/lib/supabase/types";
import { derivedCbmPerUnit, packageCbm } from "@/lib/shipments/dimensions";

import {
  productFormSchema,
  type ProductFormOutput,
  type ProductFormValues,
} from "./schema";

type StepId =
  | "basics"
  | "client"
  | "photo"
  | "pricing"
  | "logistics"
  | "packaging";

const STEPS: {
  id: StepId;
  title: string;
  description: string;
  fields: FieldPath<ProductFormValues>[];
}[] = [
  {
    id: "basics",
    title: "Basics",
    description: "Internal identifiers you use day-to-day.",
    fields: [
      "product_name",
      "category_id",
      "default_supplier",
      "unit",
      "barcode_value",
      "is_active",
    ],
  },
  {
    id: "client",
    title: "Client-facing",
    description:
      "How this product appears on proposals and client-visible documents.",
    fields: ["client_product_name", "client_description"],
  },
  {
    id: "photo",
    title: "Photo",
    description: "JPG, PNG, or WebP up to 5MB.",
    fields: ["product_image"],
  },
  {
    id: "pricing",
    title: "Pricing",
    description: "Defaults only — orders take a snapshot at line-item time.",
    fields: [
      "est_purchase_price",
      "est_currency",
      "default_sales_price",
      "sales_currency",
      "kdv_rate",
    ],
  },
  {
    id: "logistics",
    title: "Logistics",
    description:
      "Used for container-fit calculations and shipping estimates.",
    fields: ["cbm_per_unit", "weight_kg_per_unit"],
  },
  {
    id: "packaging",
    title: "Packaging",
    description: "Pick a packaging type to reveal dimension fields.",
    fields: [
      "packaging_type",
      "units_per_package",
      "package_length_cm",
      "package_width_cm",
      "package_height_cm",
    ],
  },
];
import {
  getProduct,
  listProductCategories,
  listSupplierContacts,
  productCategoryKeys,
  productImageUrl,
  productKeys,
  supplierKeys,
} from "./queries";
import {
  createProduct,
  createProductCategory,
  deleteProductImage,
  updateProduct,
  uploadProductImage,
} from "./mutations";

const DEFAULT_VALUES: ProductFormValues = {
  product_name: "",
  client_product_name: "",
  client_description: "",
  barcode_value: "",
  category_id: null,
  default_supplier: null,
  unit: "",
  is_active: true,
  product_image: null,
  est_purchase_price: "",
  est_currency: null,
  default_sales_price: "",
  sales_currency: null,
  kdv_rate: null,
  cbm_per_unit: "",
  weight_kg_per_unit: "",
  packaging_type: null,
  package_length_cm: "",
  package_width_cm: "",
  package_height_cm: "",
  units_per_package: "",
};

function toFormValues(p: ProductWithRelations): ProductFormValues {
  const packagingType = (PACKAGING_TYPES as readonly string[]).includes(
    p.packaging_type ?? "",
  )
    ? (p.packaging_type as ProductFormValues["packaging_type"])
    : null;

  return {
    product_name: p.product_name ?? "",
    client_product_name: p.client_product_name ?? "",
    client_description: p.client_description ?? "",
    barcode_value: p.barcode_value ?? "",
    category_id: p.category_id,
    default_supplier: p.default_supplier,
    unit: p.unit ?? "",
    is_active: p.is_active ?? true,
    product_image: p.product_image,
    est_purchase_price:
      p.est_purchase_price === null ? "" : String(p.est_purchase_price),
    est_currency: (BALANCE_CURRENCIES as readonly string[]).includes(
      p.est_currency ?? "",
    )
      ? (p.est_currency as ProductFormValues["est_currency"])
      : null,
    default_sales_price:
      p.default_sales_price === null ? "" : String(p.default_sales_price),
    sales_currency: (BALANCE_CURRENCIES as readonly string[]).includes(
      p.sales_currency ?? "",
    )
      ? (p.sales_currency as ProductFormValues["sales_currency"])
      : null,
    kdv_rate: p.kdv_rate,
    cbm_per_unit: p.cbm_per_unit === null ? "" : String(p.cbm_per_unit),
    weight_kg_per_unit:
      p.weight_kg_per_unit === null ? "" : String(p.weight_kg_per_unit),
    packaging_type: packagingType,
    package_length_cm:
      p.package_length_cm === null ? "" : String(p.package_length_cm),
    package_width_cm:
      p.package_width_cm === null ? "" : String(p.package_width_cm),
    package_height_cm:
      p.package_height_cm === null ? "" : String(p.package_height_cm),
    units_per_package:
      p.units_per_package === null ? "" : String(p.units_per_package),
  };
}

export function ProductFormDialog({
  open,
  onOpenChange,
  productId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId?: string | null;
}) {
  const isEdit = Boolean(productId);
  const qc = useQueryClient();

  // Lazy-init UUID for new products so storage uploads can use it as a path
  // prefix before the row is inserted. Reset on close to give each "new"
  // session a fresh ID.
  const [stableNewId, setStableNewId] = useState(() => crypto.randomUUID());
  const effectiveProductId = isEdit ? (productId as string) : stableNewId;

  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingPreview, setPendingPreview] = useState<string | null>(null);
  const [requestedRemoval, setRequestedRemoval] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setPendingFile(null);
      setPendingPreview(null);
      setRequestedRemoval(false);
      setStepIndex(0);
      if (!isEdit) setStableNewId(crypto.randomUUID());
    }
    onOpenChange(next);
  };

  const { data: categories = [] } = useQuery({
    queryKey: productCategoryKeys.all,
    queryFn: listProductCategories,
    staleTime: 60_000,
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: supplierKeys.all,
    queryFn: listSupplierContacts,
    staleTime: 60_000,
  });

  const { data: existing } = useQuery({
    queryKey: productId ? productKeys.detail(productId) : ["product", "new"],
    queryFn: () => getProduct(productId!),
    enabled: Boolean(productId) && open,
  });

  const form = useForm<ProductFormValues, unknown, ProductFormOutput>({
    resolver: zodResolver(productFormSchema) as unknown as Resolver<
      ProductFormValues,
      unknown,
      ProductFormOutput
    >,
    defaultValues: DEFAULT_VALUES,
    mode: "onBlur",
  });

  useEffect(() => {
    if (!open) return;
    if (isEdit && existing) {
      form.reset(toFormValues(existing));
    } else if (!isEdit) {
      form.reset(DEFAULT_VALUES);
    }
  }, [open, isEdit, existing, form]);

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

  useEffect(() => {
    if (!pendingPreview) return;
    return () => URL.revokeObjectURL(pendingPreview);
  }, [pendingPreview]);

  const createCategoryMut = useMutation({
    mutationFn: (name: string) => createProductCategory(name),
    onSuccess: (cat) => {
      qc.invalidateQueries({ queryKey: productCategoryKeys.all });
      form.setValue("category_id", cat.id, { shouldDirty: true });
      toast.success(`Category "${cat.name}" created`);
    },
    onError: (e: Error) =>
      toast.error(e.message ?? "Failed to create category"),
  });

  const saveMut = useMutation({
    mutationFn: async (values: ProductFormOutput) => {
      const existingImagePath = existing?.product_image ?? null;
      let imagePath: string | null = values.product_image ?? null;

      if (requestedRemoval && existingImagePath) {
        try {
          await deleteProductImage(existingImagePath);
        } catch {
          // non-fatal: surface but don't block save
        }
        imagePath = null;
      }

      if (pendingFile) {
        const newPath = await uploadProductImage(
          effectiveProductId,
          pendingFile,
        );
        if (existingImagePath && existingImagePath !== newPath) {
          try {
            await deleteProductImage(existingImagePath);
          } catch {
            // ignore cleanup failures
          }
        }
        imagePath = newPath;
      }

      const toPersist: ProductFormOutput = {
        ...values,
        product_image: imagePath,
      };

      if (isEdit) {
        return updateProduct(productId!, toPersist);
      }
      return createProduct(toPersist, effectiveProductId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: productKeys.all });
      toast.success(isEdit ? "Product updated" : "Product created");
      handleOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message ?? "Failed to save"),
  });

  const submitting = saveMut.isPending;

  const onSubmit = form.handleSubmit((values) => {
    saveMut.mutate(values);
  });

  // Always preventDefault on form submit (typically fired by Enter in an
  // input). On non-final steps Enter advances; on the final step we require an
  // explicit click on the create/save button so users can't trigger the
  // mutation just by pressing Enter while filling fields.
  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isLastStep) void goNext();
  };

  const watchPackaging = useWatch({
    control: form.control,
    name: "packaging_type",
  });
  const watchPkgL = useWatch({
    control: form.control,
    name: "package_length_cm",
  });
  const watchPkgW = useWatch({
    control: form.control,
    name: "package_width_cm",
  });
  const watchPkgH = useWatch({
    control: form.control,
    name: "package_height_cm",
  });
  const watchUnitsPerPkg = useWatch({
    control: form.control,
    name: "units_per_package",
  });
  const watchCbmPerUnit = useWatch({
    control: form.control,
    name: "cbm_per_unit",
  });

  const derivedFromPackage = useMemo(
    () =>
      derivedCbmPerUnit({
        package_length_cm: watchPkgL,
        package_width_cm: watchPkgW,
        package_height_cm: watchPkgH,
        units_per_package: watchUnitsPerPkg,
      }),
    [watchPkgL, watchPkgW, watchPkgH, watchUnitsPerPkg],
  );
  const packageVolume = useMemo(
    () =>
      packageCbm({
        package_length_cm: watchPkgL,
        package_width_cm: watchPkgW,
        package_height_cm: watchPkgH,
      }),
    [watchPkgL, watchPkgW, watchPkgH],
  );
  const explicitCbm =
    watchCbmPerUnit === null ||
    watchCbmPerUnit === undefined ||
    watchCbmPerUnit === ""
      ? null
      : Number(watchCbmPerUnit);
  const watchImagePath = useWatch({
    control: form.control,
    name: "product_image",
  });
  const watchIsActive = useWatch({
    control: form.control,
    name: "is_active",
  });

  const currentRemoteUrl = useMemo(
    () =>
      !requestedRemoval && watchImagePath ? productImageUrl(watchImagePath) : null,
    [requestedRemoval, watchImagePath],
  );

  const previewSrc = pendingPreview ?? currentRemoteUrl;

  const categoryItems = useMemo(
    () => categories.map((c) => ({ value: c.id, label: c.name })),
    [categories],
  );
  const supplierItems = useMemo(
    () =>
      suppliers
        .filter((s) => Boolean(s.company_name))
        .map((s) => ({ value: s.id, label: s.company_name as string })),
    [suppliers],
  );

  const handleFilePick = (file: File) => {
    if (!ACCEPTED_PRODUCT_IMAGE_TYPES.includes(file.type as never)) {
      toast.error("Unsupported file type. Use JPG, PNG, or WebP.");
      return;
    }
    if (file.size > MAX_PRODUCT_IMAGE_BYTES) {
      toast.error("Image is larger than 5MB.");
      return;
    }
    setPendingFile(file);
    setPendingPreview(URL.createObjectURL(file));
    setRequestedRemoval(false);
  };

  const handleRemoveImage = () => {
    setPendingFile(null);
    setPendingPreview(null);
    setRequestedRemoval(true);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit product" : "New product"}</DialogTitle>
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
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field
                  label="Product name *"
                  error={form.formState.errors.product_name?.message}
                  className="md:col-span-2"
                >
                  <Input
                    placeholder="e.g. Handwoven Wool Kilim 160x230"
                    {...form.register("product_name")}
                  />
                </Field>

                <Field label="Category">
                  <Controller
                    name="category_id"
                    control={form.control}
                    render={({ field }) => (
                      <Combobox
                        items={categoryItems}
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="Pick a category"
                        searchPlaceholder="Search or create…"
                        emptyMessage="No categories yet."
                        createLabel={(q) => `Create "${q}"`}
                        onCreate={(name) =>
                          createCategoryMut
                            .mutateAsync(name)
                            .then(() => undefined)
                        }
                      />
                    )}
                  />
                </Field>

                <Field label="Supplier">
                  <Controller
                    name="default_supplier"
                    control={form.control}
                    render={({ field }) => (
                      <Combobox
                        items={supplierItems}
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="Pick a supplier"
                        searchPlaceholder="Search suppliers…"
                        emptyMessage="No suppliers found. Add one from Contacts."
                      />
                    )}
                  />
                </Field>

                <Field label="Unit">
                  <Input
                    placeholder="pcs, m², kg…"
                    {...form.register("unit")}
                  />
                </Field>

                <Field label="Barcode">
                  <Input
                    placeholder="EAN-13, UPC, etc."
                    {...form.register("barcode_value")}
                  />
                </Field>

                <div className="flex items-end md:col-span-2">
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={Boolean(watchIsActive)}
                      onChange={(e) =>
                        form.setValue("is_active", e.target.checked, {
                          shouldDirty: true,
                        })
                      }
                      className="size-4 rounded border-input accent-primary"
                    />
                    <span>Active</span>
                    <span className="text-xs text-muted-foreground">
                      Inactive products stay in the catalog but are dimmed in
                      the list.
                    </span>
                  </label>
                </div>
              </div>
            ) : null}

            {currentStep.id === "client" ? (
              <div className="grid grid-cols-1 gap-4">
                <Field label="Client product name">
                  <Input
                    placeholder="e.g. Anatolian Kilim — Blue"
                    {...form.register("client_product_name")}
                  />
                </Field>
                <Field label="Client description">
                  <Textarea
                    rows={4}
                    placeholder="Short marketing description for proposals."
                    {...form.register("client_description")}
                  />
                </Field>
              </div>
            ) : null}

            {currentStep.id === "photo" ? (
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                <div className="flex size-32 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted/40">
                  {previewSrc ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={previewSrc}
                      alt="Product preview"
                      className="size-full object-cover"
                    />
                  ) : (
                    <ImageIcon className="size-8 text-muted-foreground" />
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <label className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-sm hover:bg-muted">
                    <Upload className="size-4" />
                    {previewSrc ? "Replace image" : "Upload image"}
                    <input
                      type="file"
                      accept={ACCEPTED_PRODUCT_IMAGE_TYPES.join(",")}
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleFilePick(f);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  {previewSrc ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="w-fit text-destructive hover:text-destructive"
                      onClick={handleRemoveImage}
                    >
                      <Trash2 className="mr-2 size-4" />
                      Remove image
                    </Button>
                  ) : null}
                  <p className="text-xs text-muted-foreground">
                    Image uploads when you save the product.
                  </p>
                </div>
              </div>
            ) : null}

            {currentStep.id === "pricing" ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field
                  label="Est. purchase price"
                  error={form.formState.errors.est_purchase_price?.message}
                >
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    {...form.register("est_purchase_price")}
                  />
                </Field>
                <Field label="Purchase currency">
                  <Controller
                    name="est_currency"
                    control={form.control}
                    render={({ field }) => (
                      <Select
                        value={field.value ?? ""}
                        onValueChange={(v) =>
                          field.onChange(v === "" ? null : v)
                        }
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
                  label="Default sales price"
                  error={form.formState.errors.default_sales_price?.message}
                >
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    {...form.register("default_sales_price")}
                  />
                </Field>
                <Field label="Sales currency">
                  <Controller
                    name="sales_currency"
                    control={form.control}
                    render={({ field }) => (
                      <Select
                        value={field.value ?? ""}
                        onValueChange={(v) =>
                          field.onChange(v === "" ? null : v)
                        }
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

                <Field label="KDV rate">
                  <Controller
                    name="kdv_rate"
                    control={form.control}
                    render={({ field }) => (
                      <Select
                        value={field.value === null ? "" : String(field.value)}
                        onValueChange={(v) =>
                          field.onChange(v === "" ? null : Number(v))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select KDV rate" />
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
              </div>
            ) : null}

            {currentStep.id === "logistics" ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field
                  label="CBM per unit (m³)"
                  error={form.formState.errors.cbm_per_unit?.message}
                  hint={
                    derivedFromPackage !== null
                      ? `Derived from package dims: ${derivedFromPackage.toFixed(
                          4,
                        )} m³ — leave blank to use this value`
                      : "Will fall back to (L × W × H ÷ 1,000,000 ÷ units per package) when blank"
                  }
                >
                  <Input
                    type="number"
                    step="0.0001"
                    min="0"
                    placeholder={
                      derivedFromPackage !== null
                        ? derivedFromPackage.toFixed(4)
                        : "0.0000"
                    }
                    {...form.register("cbm_per_unit")}
                  />
                </Field>
                <Field
                  label="Weight per unit (kg)"
                  error={form.formState.errors.weight_kg_per_unit?.message}
                >
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    {...form.register("weight_kg_per_unit")}
                  />
                </Field>
              </div>
            ) : null}

            {currentStep.id === "packaging" ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field label="Packaging type" className="md:col-span-2">
                  <Controller
                    name="packaging_type"
                    control={form.control}
                    render={({ field }) => (
                      <Select
                        value={field.value ?? ""}
                        onValueChange={(v) =>
                          field.onChange(v === "" ? null : v)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select packaging" />
                        </SelectTrigger>
                        <SelectContent>
                          {PACKAGING_TYPES.map((p) => (
                            <SelectItem key={p} value={p}>
                              {PACKAGING_TYPE_LABELS[p]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </Field>

                {watchPackaging ? (
                  <>
                    <Field
                      label="Units per package"
                      error={form.formState.errors.units_per_package?.message}
                    >
                      <Input
                        type="number"
                        step="1"
                        min="0"
                        placeholder="0"
                        {...form.register("units_per_package")}
                      />
                    </Field>
                    <Field
                      label="Length (cm)"
                      error={form.formState.errors.package_length_cm?.message}
                    >
                      <Input
                        type="number"
                        step="0.1"
                        min="0"
                        placeholder="0"
                        {...form.register("package_length_cm")}
                      />
                    </Field>
                    <Field
                      label="Width (cm)"
                      error={form.formState.errors.package_width_cm?.message}
                    >
                      <Input
                        type="number"
                        step="0.1"
                        min="0"
                        placeholder="0"
                        {...form.register("package_width_cm")}
                      />
                    </Field>
                    <Field
                      label="Height (cm)"
                      error={form.formState.errors.package_height_cm?.message}
                    >
                      <Input
                        type="number"
                        step="0.1"
                        min="0"
                        placeholder="0"
                        {...form.register("package_height_cm")}
                      />
                    </Field>

                    {packageVolume !== null || derivedFromPackage !== null ? (
                      <div className="md:col-span-2 rounded-md border bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
                        {packageVolume !== null ? (
                          <div>
                            Package volume:{" "}
                            <span className="font-medium text-foreground tabular-nums">
                              {packageVolume.toFixed(4)} m³
                            </span>
                          </div>
                        ) : null}
                        {derivedFromPackage !== null ? (
                          <div>
                            Derived CBM per unit:{" "}
                            <span className="font-medium text-foreground tabular-nums">
                              {derivedFromPackage.toFixed(4)} m³
                            </span>
                            {explicitCbm !== null && explicitCbm > 0 ? (
                              <span className="ml-1 text-muted-foreground">
                                (overridden by explicit CBM ={" "}
                                {explicitCbm.toFixed(4)} m³)
                              </span>
                            ) : (
                              <span className="ml-1 text-emerald-700">
                                — used because CBM per unit is blank
                              </span>
                            )}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </>
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
                onClick={() => handleOpenChange(false)}
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
                      : "Create product"}
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
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-[11px] text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
