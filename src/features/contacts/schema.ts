import { z } from "zod";
import { BALANCE_CURRENCIES, CONTACT_ROLES } from "@/lib/supabase/types";

const trimmed = () => z.string().trim();

export const contactFormSchema = z.object({
  company_name: trimmed().min(1, "Company name is required"),
  contact_person: trimmed().optional(),
  roles: z
    .array(z.enum(CONTACT_ROLES))
    .min(1, "Pick at least one role"),
  phone: trimmed().optional(),
  email: trimmed()
    .optional()
    .refine(
      (v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
      "Invalid email",
    ),
  address: trimmed().optional(),
  city: trimmed().optional(),
  country_code: trimmed().optional(),
  balance_currency: z
    .enum(BALANCE_CURRENCIES)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  tax_id: trimmed().optional(),
  tax_office: trimmed().optional(),
  notes: z.string().optional(),
});

export type ContactFormValues = z.input<typeof contactFormSchema>;
export type ContactFormOutput = z.output<typeof contactFormSchema>;

export const contactNoteFormSchema = z.object({
  note_date: z
    .string()
    .min(1, "Date is required")
    .refine((v) => !Number.isNaN(Date.parse(v)), "Invalid date"),
  body: z.string().trim().min(1, "Note cannot be empty"),
});

export type ContactNoteFormValues = z.infer<typeof contactNoteFormSchema>;
