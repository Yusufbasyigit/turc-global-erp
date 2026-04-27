import { z } from "zod";
import {
  ASSET_TYPES,
  CUSTODY_LOCATION_TYPES,
} from "@/lib/supabase/types";

const NAME_MAX = 80;
const CODE_MAX = 20;
const FREE_TEXT_MAX = 60;

// Loose ISO 13616 IBAN check: 2 letters + 2 digits + 11–30 alphanumeric.
// Spaces are stripped before matching. Don't reject non-Turkish IBANs.
const IBAN_REGEX = /^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/;

const blankToNull = (v: unknown) => {
  if (typeof v !== "string") return v;
  const t = v.trim();
  return t.length === 0 ? null : t;
};

const optionalText = (max: number) =>
  z.preprocess(
    blankToNull,
    z.string().trim().max(max).nullable().optional(),
  );

export const accountFormSchema = z
  .object({
    account_name: z
      .string()
      .trim()
      .min(1, "Account name is required")
      .max(NAME_MAX, `Max ${NAME_MAX} characters`),
    asset_type: z.enum(ASSET_TYPES),
    asset_code: z
      .string()
      .trim()
      .min(1, "Asset code is required")
      .max(CODE_MAX, `Max ${CODE_MAX} characters`),
    custody_location_id: z
      .string()
      .uuid("Pick a custody location"),
    bank_name: optionalText(FREE_TEXT_MAX),
    iban: z.preprocess(blankToNull, z.string().trim().nullable().optional()),
    account_type: optionalText(FREE_TEXT_MAX),
    subtype: optionalText(FREE_TEXT_MAX),
    // Hidden cross-field: the selected custody's location_type.
    // The form keeps this in sync via useWatch on custody_location_id.
    _custody_location_type: z
      .enum(CUSTODY_LOCATION_TYPES)
      .nullable()
      .optional(),
  })
  .superRefine((v, ctx) => {
    // Asset code: uppercase except for metals (preserves Altın / Gümüş).
    // Done in superRefine via mutation so output reflects the canonical form.
    if (v.asset_type !== "metal") {
      v.asset_code = v.asset_code.toUpperCase();
    }

    // Metal must be in physical custody.
    if (
      v.asset_type === "metal" &&
      v._custody_location_type &&
      v._custody_location_type !== "physical"
    ) {
      ctx.addIssue({
        path: ["custody_location_id"],
        code: z.ZodIssueCode.custom,
        message: "Metal accounts must be held in a physical custody location.",
      });
    }

    // IBAN, when present, must look like an IBAN.
    if (v.iban) {
      const stripped = v.iban.replace(/\s+/g, "").toUpperCase();
      if (!IBAN_REGEX.test(stripped)) {
        ctx.addIssue({
          path: ["iban"],
          code: z.ZodIssueCode.custom,
          message: "Doesn't look like a valid IBAN",
        });
      } else {
        v.iban = stripped;
      }
    }

    // Bank/IBAN/account_type are only meaningful for fiat.
    // Subtype is only meaningful for fund.
    // We don't error on unrelated fields — the mutation strips them — but we
    // do block subtype for non-fund just to keep the form honest.
    if (v.asset_type !== "fund" && v.subtype) {
      ctx.addIssue({
        path: ["subtype"],
        code: z.ZodIssueCode.custom,
        message: "Subtype only applies to fund accounts",
      });
    }
  });

export type AccountFormValues = z.input<typeof accountFormSchema>;
export type AccountFormOutput = z.output<typeof accountFormSchema>;
