import { z } from "zod";
import {
  BALANCE_CURRENCIES,
  KDV_RATES,
  PACKAGING_TYPES,
} from "@/lib/supabase/types";

const trimmed = () => z.string().trim();

const optionalNumber = z.preprocess(
  (v) => {
    if (v === null || v === undefined) return null;
    if (typeof v === "number") {
      return Number.isFinite(v) ? v : null;
    }
    if (typeof v === "string") {
      const t = v.trim();
      if (t === "") return null;
      const n = Number(t);
      return Number.isFinite(n) ? n : NaN;
    }
    return null;
  },
  z
    .number({ error: "Must be a number" })
    .min(0, "Must be zero or greater")
    .nullable(),
);

// Same shape as optionalNumber but rejects zero. Used for line-item prices,
// where `null` is the legitimate "not yet priced" state but `0` is a data
// error (the order-mutations.ts inquiry→quoted gate rejects price <= 0, so
// a 0 here would only surface as a confusing error on advance).
const optionalPositiveNumber = z.preprocess(
  (v) => {
    if (v === null || v === undefined) return null;
    if (typeof v === "number") {
      return Number.isFinite(v) ? v : null;
    }
    if (typeof v === "string") {
      const t = v.trim();
      if (t === "") return null;
      const n = Number(t);
      return Number.isFinite(n) ? n : NaN;
    }
    return null;
  },
  z
    .number({ error: "Must be a number" })
    .positive("Must be greater than zero")
    .nullable(),
);

const requiredPositive = z.preprocess(
  (v) => {
    if (v === null || v === undefined || v === "") return NaN;
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : NaN;
  },
  z.number({ error: "Required" }).positive("Must be greater than zero"),
);

const optionalPackaging = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? null : v),
  z.enum(PACKAGING_TYPES).nullable(),
);

const optionalKdv = z.preprocess(
  (v) => {
    if (v === null || v === undefined || v === "") return null;
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : null;
  },
  z
    .number()
    .nullable()
    .refine(
      (v) => v === null || (KDV_RATES as readonly number[]).includes(v),
      { message: "Invalid KDV rate" },
    ),
);

const optionalId = z.preprocess(
  (v) => {
    if (v === null || v === undefined) return null;
    if (typeof v === "string") {
      const t = v.trim();
      return t === "" ? null : t;
    }
    return null;
  },
  z.string().nullable(),
);

export const orderLineSchema = z.object({
  product_id: z.string().min(1, "Select a product"),
  quantity: requiredPositive,
  unit_sales_price: optionalPositiveNumber,
  est_purchase_unit_price: optionalNumber,
  actual_purchase_price: optionalNumber,
  vat_rate: optionalKdv,
  supplier_id: optionalId,
  notes: z.string().optional().default(""),

  product_name_snapshot: trimmed().min(1),
  product_description_snapshot: z.string().nullable().optional(),
  product_photo_snapshot: z.string().nullable().optional(),
  unit_snapshot: z.string().nullable().optional().default(""),
  cbm_per_unit_snapshot: optionalNumber,
  weight_kg_per_unit_snapshot: optionalNumber,

  packaging_type: optionalPackaging,
  package_length_cm: optionalNumber,
  package_width_cm: optionalNumber,
  package_height_cm: optionalNumber,
  units_per_package: optionalNumber,
});

export type OrderLineValues = z.infer<typeof orderLineSchema>;

export const orderFormSchema = z.object({
  customer_id: z.string().min(1, "Customer is required"),
  order_date: trimmed().min(1, "Order date is required"),
  order_currency: z.enum(BALANCE_CURRENCIES),
  notes: z.string().optional().default(""),
  lines: z.array(orderLineSchema),
});

export type OrderFormValues = {
  customer_id: string;
  order_date: string;
  order_currency: (typeof BALANCE_CURRENCIES)[number];
  notes?: string;
  lines: Array<{
    product_id: string;
    quantity: string | number;
    unit_sales_price: string | number | null;
    est_purchase_unit_price: string | number | null;
    actual_purchase_price: string | number | null;
    vat_rate: number | string | null;
    supplier_id: string | null;
    notes?: string;
    product_name_snapshot: string;
    product_description_snapshot: string | null;
    product_photo_snapshot: string | null;
    unit_snapshot: string | null;
    cbm_per_unit_snapshot: string | number | null;
    weight_kg_per_unit_snapshot: string | number | null;
    packaging_type: (typeof PACKAGING_TYPES)[number] | "" | null;
    package_length_cm: string | number | null;
    package_width_cm: string | number | null;
    package_height_cm: string | number | null;
    units_per_package: string | number | null;
  }>;
};

export type OrderFormOutput = z.output<typeof orderFormSchema>;

export const packagingOverrideSchema = z.object({
  packaging_type: optionalPackaging,
  package_length_cm: optionalNumber,
  package_width_cm: optionalNumber,
  package_height_cm: optionalNumber,
  units_per_package: optionalNumber,
});

export type PackagingOverrideValues = z.infer<typeof packagingOverrideSchema>;

export const cancelOrderSchema = z.object({
  reason: trimmed().min(3, "Reason must be at least 3 characters"),
});

export type CancelOrderValues = z.infer<typeof cancelOrderSchema>;
