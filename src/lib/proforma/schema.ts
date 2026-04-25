import { z } from "zod";

const optionalString = z
  .string()
  .transform((v) => v.trim())
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .optional();

const optionalDate = z
  .string()
  .transform((v) => v.trim())
  .refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v), {
    message: "Use YYYY-MM-DD",
  })
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .optional();

export const proformaFormSchema = z.object({
  offer_date: optionalDate,
  offer_valid_until: optionalDate,
  incoterm: optionalString,
  delivery_timeline: optionalString,
  payment_terms: optionalString,
  proforma_notes_remark: optionalString,
  proforma_notes_validity: optionalString,
  proforma_notes_delivery_location: optionalString,
  proforma_notes_production_time: optionalString,
  proforma_notes_length_tolerance: optionalString,
  proforma_notes_total_weight: optionalString,
});

export type ProformaFormValues = z.input<typeof proformaFormSchema>;
export type ProformaFormOutput = z.output<typeof proformaFormSchema>;

export type ProformaFieldSource = {
  offer_date: string | null;
  incoterm: string | null;
  payment_terms: string | null;
};

const REQUIRED_FIELD_LABELS: Record<keyof ProformaFieldSource, string> = {
  offer_date: "Offer date",
  incoterm: "Incoterm",
  payment_terms: "Payment terms",
};

export function getMissingProformaFields(
  source: ProformaFieldSource,
): string[] {
  const missing: string[] = [];
  for (const key of Object.keys(REQUIRED_FIELD_LABELS) as Array<
    keyof ProformaFieldSource
  >) {
    const value = source[key];
    if (value === null || value === undefined || String(value).trim() === "") {
      missing.push(REQUIRED_FIELD_LABELS[key]);
    }
  }
  return missing;
}
