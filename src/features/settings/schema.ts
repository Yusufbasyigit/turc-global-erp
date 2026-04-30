import { z } from "zod";
import { CUSTODY_LOCATION_TYPES } from "@/lib/supabase/types";

const FIELD_MAX = 200;

export const appSettingsFormSchema = z.object({
  company_name: z
    .string()
    .trim()
    .min(1, "Company name is required")
    .max(FIELD_MAX, `Max ${FIELD_MAX} characters`),
  address_line1: z
    .string()
    .trim()
    .min(1, "Address line 1 is required")
    .max(FIELD_MAX, `Max ${FIELD_MAX} characters`),
  address_line2: z
    .string()
    .trim()
    .min(1, "Address line 2 is required")
    .max(FIELD_MAX, `Max ${FIELD_MAX} characters`),
  phone: z
    .string()
    .trim()
    .min(1, "Phone is required")
    .max(FIELD_MAX, `Max ${FIELD_MAX} characters`),
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .email("Doesn't look like an email")
    .max(FIELD_MAX, `Max ${FIELD_MAX} characters`),
});

export type AppSettingsFormValues = z.infer<typeof appSettingsFormSchema>;

const NAME_MAX = 80;

export const custodyLocationFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(NAME_MAX, `Max ${NAME_MAX} characters`),
  location_type: z.enum(CUSTODY_LOCATION_TYPES),
  requires_movement_type: z.boolean(),
});

export type CustodyLocationFormValues = z.infer<
  typeof custodyLocationFormSchema
>;
