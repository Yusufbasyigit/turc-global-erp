import { z } from "zod";

const nullableString = z
  .union([z.string(), z.null()])
  .optional()
  .transform((v) => (v === undefined ? null : v));

const nullableNumber = z
  .union([z.number(), z.null()])
  .optional()
  .transform((v) => (v === undefined ? null : v));

const currencyCode = z
  .string()
  .length(3, "Currency must be a 3-letter ISO code")
  .transform((s) => s.toUpperCase());

const nullableCurrency = z
  .union([currencyCode, z.null()])
  .optional()
  .transform((v) => (v === undefined ? null : v));

export const proformaLineSchema = z.object({
  line_number: z.number().int().min(1),
  description: z.string().min(1),
  supplier_sku: nullableString,
  hs_code: nullableString,
  primary_quantity: z.number().positive(),
  primary_unit: z.string().min(1),
  secondary_quantities: z
    .union([z.record(z.string(), z.number()), z.null()])
    .optional()
    .transform((v) => (v === undefined ? null : v)),
  unit_price: z.number().nonnegative(),
  line_currency: currencyCode.optional(),
  line_total: z.number().nonnegative(),
  notes: nullableString,
  proposed_product_name: z.string().min(1).max(120),
});

export const proformaImportSchema = z.object({
  proforma_reference: nullableString,
  proforma_date: nullableString,
  supplier_name: nullableString,
  currency: nullableCurrency,
  totals: z
    .union([
      z.object({
        subtotal: nullableNumber,
        vat_amount: nullableNumber,
        grand_total: nullableNumber,
      }),
      z.null(),
    ])
    .optional()
    .transform((v) => (v === undefined ? null : v)),
  lines: z.array(proformaLineSchema).min(1, "At least one line is required"),
});

export type ProformaImport = z.infer<typeof proformaImportSchema>;
export type ProformaLine = z.infer<typeof proformaLineSchema>;

export const PROFORMA_EXTRACTION_PROMPT = `You are extracting line items from a supplier proforma invoice PDF.

Return ONLY a JSON object matching this exact shape (no prose, no markdown):

{
  "proforma_reference": "string or null",
  "proforma_date": "YYYY-MM-DD or null",
  "supplier_name": "string or null",
  "currency": "3-letter ISO code or null (e.g. USD, EUR, TRY)",
  "totals": {
    "subtotal": "number or null",
    "vat_amount": "number or null",
    "grand_total": "number or null"
  },
  "lines": [
    {
      "line_number": "integer starting at 1",
      "description": "string, full product description as on the proforma",
      "supplier_sku": "string or null",
      "hs_code": "string or null (digits only, e.g. 180690600000)",
      "primary_quantity": "number",
      "primary_unit": "string (m2, pcs, box, koli, kg, etc.)",
      "secondary_quantities": "object or null (e.g. {\\"pallets\\": 2})",
      "unit_price": "number — EFFECTIVE per-unit price after any discounts",
      "line_currency": "3-letter ISO code, defaults to header currency",
      "line_total": "number — quantity × unit_price after discounts",
      "notes": "string or null",
      "proposed_product_name": "clean English product name suitable for a catalog"
    }
  ]
}

Rules:
- If the proforma shows a list price, sale price, and a discount percent, compute the effective unit_price yourself and return ONLY that final number. Do not return list_price or discount_percent.
- Extract hs_code / GTIP when visible on the document.
- Keep proposed_product_name short and descriptive (under 80 chars).
- Return valid JSON only. No leading/trailing text.`;
