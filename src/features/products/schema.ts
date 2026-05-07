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

const optionalCurrency = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? null : v),
  z.enum(BALANCE_CURRENCIES).nullable(),
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

export const productFormSchema = z.object({
  product_name: trimmed().min(1, "Product name is required"),
  client_product_name: trimmed().optional().default(""),
  client_description: z.string().optional().default(""),
  barcode_value: trimmed().optional().default(""),
  hs_code: trimmed().optional().default(""),
  category_id: optionalId,
  default_supplier: optionalId,
  unit: trimmed().optional().default(""),
  is_active: z.boolean(),
  product_image: optionalId,

  est_purchase_price: optionalNumber,
  est_currency: optionalCurrency,
  default_sales_price: optionalNumber,
  sales_currency: optionalCurrency,
  kdv_rate: optionalKdv,

  cbm_per_unit: optionalNumber,
  weight_kg_per_unit: optionalNumber,

  packaging_type: optionalPackaging,
  package_length_cm: optionalNumber,
  package_width_cm: optionalNumber,
  package_height_cm: optionalNumber,
  units_per_package: optionalNumber,
});

export type ProductFormValues = {
  product_name: string;
  client_product_name?: string;
  client_description?: string;
  barcode_value?: string;
  hs_code?: string;
  category_id: string | null;
  default_supplier: string | null;
  unit?: string;
  is_active: boolean;
  product_image: string | null;
  est_purchase_price: string | number | null;
  est_currency:
    | (typeof BALANCE_CURRENCIES)[number]
    | ""
    | null;
  default_sales_price: string | number | null;
  sales_currency:
    | (typeof BALANCE_CURRENCIES)[number]
    | ""
    | null;
  kdv_rate: number | string | null;
  cbm_per_unit: string | number | null;
  weight_kg_per_unit: string | number | null;
  packaging_type:
    | (typeof PACKAGING_TYPES)[number]
    | ""
    | null;
  package_length_cm: string | number | null;
  package_width_cm: string | number | null;
  package_height_cm: string | number | null;
  units_per_package: string | number | null;
};

export type ProductFormOutput = z.output<typeof productFormSchema>;

export const categoryCreateSchema = z.object({
  name: z.string().trim().min(1, "Category name is required"),
});

export type CategoryCreateValues = z.infer<typeof categoryCreateSchema>;
