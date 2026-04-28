import { z } from "zod";
import { BALANCE_CURRENCIES } from "@/lib/supabase/types";

const trimmedString = (max: number, msg: string) =>
  z.string().trim().min(1, msg).max(max);

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

const positiveNumber = (msg = "Must be greater than zero") =>
  z.preprocess(
    (v) => {
      if (v === "" || v === null || v === undefined) return undefined;
      const n = typeof v === "number" ? v : Number(v);
      return Number.isFinite(n) ? n : NaN;
    },
    z.number({ error: "Must be a number" }).positive(msg),
  );

const dateString = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date");

const optionalDate = z.preprocess(
  blankToNull,
  z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date")
    .nullable()
    .optional(),
);

// Template form schema. The `kind` choices are kept narrow on purpose; most
// recurring payments are 'expense'. supplier_payment is included for the
// rare case of a fixed monthly invoice cycle.
export const recurringPaymentFormSchema = z
  .object({
    name: trimmedString(80, "Name is required"),
    description: optionalText(200),
    kind: z.enum([
      "expense",
      "supplier_payment",
      "tax_payment",
    ]),
    expected_amount: positiveNumber("Amount must be positive"),
    currency: z.enum(BALANCE_CURRENCIES),
    day_of_month: z.preprocess(
      (v) => {
        if (v === "" || v === null || v === undefined) return undefined;
        const n = typeof v === "number" ? v : Number(v);
        return Number.isFinite(n) ? n : NaN;
      },
      z
        .number({ error: "Pick a day" })
        .int("Whole number")
        .min(1, "1–31")
        .max(31, "1–31"),
    ),
    account_id: z.string().uuid("Pick an account"),
    contact_id: z.preprocess(
      blankToNull,
      z.string().uuid().nullable().optional(),
    ),
    expense_type_id: z.preprocess(
      blankToNull,
      z.string().uuid().nullable().optional(),
    ),
    effective_from: dateString,
    end_date: optionalDate,
    notes: optionalText(400),
  })
  .superRefine((v, ctx) => {
    if (v.end_date && v.end_date < v.effective_from) {
      ctx.addIssue({
        path: ["end_date"],
        code: z.ZodIssueCode.custom,
        message: "End date can't be before the start.",
      });
    }
  });

export type RecurringPaymentFormValues = z.input<
  typeof recurringPaymentFormSchema
>;
export type RecurringPaymentFormOutput = z.output<
  typeof recurringPaymentFormSchema
>;

// Mark-paid form: confirms or overrides amount and date for a single month.
export const markPaidFormSchema = z.object({
  paid_amount: positiveNumber("Amount must be positive"),
  paid_date: dateString,
  notes: optionalText(200),
});

export type MarkPaidFormValues = z.input<typeof markPaidFormSchema>;
export type MarkPaidFormOutput = z.output<typeof markPaidFormSchema>;
