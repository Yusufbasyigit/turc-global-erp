import { z } from "zod";

export const partnerFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(100, "Name is too long"),
});

export type PartnerFormValues = z.input<typeof partnerFormSchema>;
export type PartnerFormOutput = z.output<typeof partnerFormSchema>;
