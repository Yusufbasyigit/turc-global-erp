import { z } from "zod";
import { BALANCE_CURRENCIES, KDV_RATES } from "@/lib/supabase/types";

const nullableString = z
  .union([z.string(), z.null()])
  .optional()
  .transform((v) => (v === undefined ? null : v));

const nullableNumber = z
  .union([z.number(), z.null()])
  .optional()
  .transform((v) => (v === undefined ? null : v));

const nullableCurrency = z
  .union([
    z
      .string()
      .length(3, "Currency must be a 3-letter ISO code")
      .transform((s) => s.toUpperCase()),
    z.null(),
  ])
  .optional()
  .transform((v) => (v === undefined ? null : v))
  .refine(
    (v) =>
      v === null ||
      (BALANCE_CURRENCIES as readonly string[]).includes(v),
    { message: `Currency must be one of ${BALANCE_CURRENCIES.join(", ")}` },
  )
  .transform((v) => v as (typeof BALANCE_CURRENCIES)[number] | null);

const nullableKdv = z
  .union([z.number(), z.null()])
  .optional()
  .transform((v) => (v === undefined ? null : v))
  .refine(
    (v) => v === null || (KDV_RATES as readonly number[]).includes(v),
    { message: `KDV rate must be one of ${KDV_RATES.join(", ")}` },
  )
  .transform((v) => v as (typeof KDV_RATES)[number] | null);

export const productBatchLineSchema = z.object({
  product_name: z.string().trim().min(1).max(120),
  client_product_name: nullableString,
  client_description: nullableString,
  barcode_value: nullableString,
  unit: nullableString,
  est_purchase_price: nullableNumber,
  est_currency: nullableCurrency,
  default_sales_price: nullableNumber,
  sales_currency: nullableCurrency,
  kdv_rate: nullableKdv,
  weight_kg_per_unit: nullableNumber,
  cbm_per_unit: nullableNumber,
  hs_code: nullableString,
  category_hint: nullableString,
  supplier_sku: nullableString,
});

export const productBatchImportSchema = z.object({
  supplier_name: nullableString,
  products: z
    .array(productBatchLineSchema)
    .min(1, "At least one product is required"),
});

export type ProductBatchImport = z.infer<typeof productBatchImportSchema>;
export type ProductBatchLine = z.infer<typeof productBatchLineSchema>;

export const PRODUCT_BATCH_EXTRACTION_PROMPT = `You are extracting products from a supplier catalog or price list (PDF / Excel / image).

Return ONLY a JSON object matching this exact shape (no prose, no markdown):

{
  "supplier_name": "string or null",
  "products": [
    {
      "product_name": "clean English product name (required, under 120 chars)",
      "client_product_name": "string or null (the name the end client uses, if different)",
      "client_description": "string or null (longer description for end client)",
      "barcode_value": "string or null (EAN/UPC/GTIN if present)",
      "unit": "string or null (pcs, m2, kg, box, koli, etc.)",
      "est_purchase_price": "number or null (per-unit purchase price from this supplier)",
      "est_currency": "TRY, EUR, USD, or GBP — null if not stated",
      "default_sales_price": "number or null (per-unit sales price, if listed)",
      "sales_currency": "TRY, EUR, USD, or GBP — null if not stated",
      "kdv_rate": "0, 1, 10, or 20 — Turkish VAT percent. null if not stated",
      "weight_kg_per_unit": "number or null",
      "cbm_per_unit": "number or null (cubic meters per unit)",
      "hs_code": "string or null (digits only, e.g. 180690600000)",
      "category_hint": "string or null (free-text category name from the catalog — informational only)",
      "supplier_sku": "string or null (informational only)"
    }
  ]
}

Rules:
- Do NOT include images, photos, or file references — those are added later in the app.
- Use only TRY, EUR, USD, or GBP for currency fields. If the document shows another code, leave the field null.
- Use only 0, 1, 10, or 20 for kdv_rate. Otherwise null.
- Keep product_name short and descriptive (under 120 chars).
- If the catalog shows list price, sale price, and a discount, compute the effective per-unit price yourself and return ONLY that final number in est_purchase_price.
- Return valid JSON only. No leading/trailing text.`;
