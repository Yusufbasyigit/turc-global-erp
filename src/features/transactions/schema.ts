import { z } from "zod";
import {
  BALANCE_CURRENCIES,
  KDV_RATES,
  TRANSACTION_KINDS,
} from "@/lib/supabase/types";

const requiredString = (msg: string) => z.string().trim().min(1, msg);

const positiveNumber = (msg = "Must be greater than zero") =>
  z.preprocess(
    (v) => {
      if (v === "" || v === null || v === undefined) return undefined;
      const n = typeof v === "number" ? v : Number(v);
      return Number.isFinite(n) ? n : NaN;
    },
    z.number({ error: "Must be a number" }).positive(msg),
  );

const optionalPositiveNumber = z.preprocess(
  (v) => {
    if (v === "" || v === null || v === undefined) return undefined;
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : NaN;
  },
  z.number({ error: "Must be a number" }).positive().optional(),
);

const dateString = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date");

const currency = z.enum(BALANCE_CURRENCIES);

// The form writes vat_rate as a number (e.g. 20) or null. Coerce string inputs
// (URL prefill, edit-load fallback) into the matching KDV_RATES number, then
// gate the value to the allowed enum.
const KDV_RATE_NUMBERS = KDV_RATES as readonly number[];
const vatRate = z
  .preprocess((v) => {
    if (v === "" || v === null || v === undefined) return null;
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : v;
  }, z.union([z.literal(null), z.number().refine((n) => KDV_RATE_NUMBERS.includes(n), {
    message: "Pick a valid VAT rate",
  })]))
  .nullable()
  .optional();

const commonFields = {
  transaction_date: dateString,
  amount: positiveNumber("Amount must be positive"),
  currency,
  description: z.string().optional().default(""),
  reference_number: z.string().optional().default(""),
};

const payerToggle = z.enum(["business", "partner"]);

export const transactionSchema = z
  .discriminatedUnion("kind", [
    // WAVE 1 — client_payment
    z.object({
      kind: z.literal("client_payment"),
      contact_id: requiredString("Pick a customer"),
      contact_balance_currency: z.string().optional().default(""),
      to_account_id: requiredString("Pick a destination account"),
      fx_rate_applied: optionalPositiveNumber,
      fx_target_currency: z.string().optional().default(""),
      fx_converted_amount: optionalPositiveNumber,
      real_estate_deal_id: z.string().optional().default(""),
      ...commonFields,
    }),
    // WAVE 1 — client_refund
    z.object({
      kind: z.literal("client_refund"),
      contact_id: requiredString("Pick a customer"),
      contact_balance_currency: z.string().optional().default(""),
      from_account_id: requiredString("Pick a source account"),
      fx_rate_applied: optionalPositiveNumber,
      fx_target_currency: z.string().optional().default(""),
      fx_converted_amount: optionalPositiveNumber,
      ...commonFields,
    }),
    // WAVE 1 — expense
    z.object({
      kind: z.literal("expense"),
      expense_type_id: requiredString("Pick an expense type"),
      contact_id: z.string().optional().default(""),
      paid_by: payerToggle,
      from_account_id: z.string().optional().default(""),
      partner_id: z.string().optional().default(""),
      vat_rate: vatRate,
      vat_amount: optionalPositiveNumber,
      net_amount: optionalPositiveNumber,
      ...commonFields,
    }),
    // WAVE 1 — other_income
    z.object({
      kind: z.literal("other_income"),
      to_account_id: requiredString("Pick a destination account"),
      ...commonFields,
    }),
    // WAVE 2 — supplier_invoice (accrual, spawns no movement)
    z.object({
      kind: z.literal("supplier_invoice"),
      contact_id: requiredString("Pick a supplier"),
      vat_rate: vatRate,
      vat_amount: optionalPositiveNumber,
      net_amount: optionalPositiveNumber,
      ...commonFields,
    }),
    // WAVE 2 — supplier_payment (cash out, optional link to invoice)
    z.object({
      kind: z.literal("supplier_payment"),
      contact_id: requiredString("Pick a supplier"),
      from_account_id: requiredString("Pick a source account"),
      related_payable_id: z.string().optional().default(""),
      ...commonFields,
    }),
    // WAVE 2 — partner_loan_in (cash in)
    z.object({
      kind: z.literal("partner_loan_in"),
      partner_id: requiredString("Pick a partner"),
      to_account_id: requiredString("Pick a destination account"),
      ...commonFields,
    }),
    // WAVE 2 — partner_loan_out (cash out)
    z.object({
      kind: z.literal("partner_loan_out"),
      partner_id: requiredString("Pick a partner"),
      from_account_id: requiredString("Pick a source account"),
      ...commonFields,
    }),
    // WAVE 2 — profit_distribution (cash out, leg of a PSD event — never tied
    // to a partner; logged exclusively via the PSD dialog on /partners)
    z.object({
      kind: z.literal("profit_distribution"),
      from_account_id: requiredString("Pick a source account"),
      ...commonFields,
    }),
    // WAVE 2 — tax_payment (cash out, no counterparty)
    z.object({
      kind: z.literal("tax_payment"),
      from_account_id: requiredString("Pick a source account"),
      kdv_period: z
        .string()
        .trim()
        .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Use YYYY-MM")
        .optional()
        .or(z.literal("")),
      ...commonFields,
    }),
  ])
  .superRefine((v, ctx) => {
    if (v.kind === "client_payment" || v.kind === "client_refund") {
      const needsFx =
        v.contact_balance_currency &&
        v.contact_balance_currency !== v.currency;
      if (needsFx) {
        if (!v.fx_rate_applied) {
          ctx.addIssue({
            path: ["fx_rate_applied"],
            code: z.ZodIssueCode.custom,
            message: "FX rate required when currency differs from client balance",
          });
        }
      }
    }
    if (v.kind === "expense") {
      if (v.paid_by === "business" && !v.from_account_id) {
        ctx.addIssue({
          path: ["from_account_id"],
          code: z.ZodIssueCode.custom,
          message: "Pick a source account",
        });
      }
      if (v.paid_by === "partner" && !v.partner_id) {
        ctx.addIssue({
          path: ["partner_id"],
          code: z.ZodIssueCode.custom,
          message: "Pick a partner",
        });
      }
      if (v.paid_by === "business" && v.partner_id) {
        ctx.addIssue({
          path: ["partner_id"],
          code: z.ZodIssueCode.custom,
          message: "Clear partner when Business pays",
        });
      }
      if (v.paid_by === "partner" && v.from_account_id) {
        ctx.addIssue({
          path: ["from_account_id"],
          code: z.ZodIssueCode.custom,
          message: "Clear source account when Partner pays",
        });
      }
      if (v.paid_by === "partner" && v.contact_id) {
        ctx.addIssue({
          path: ["contact_id"],
          code: z.ZodIssueCode.custom,
          message: "Clear supplier when Partner pays",
        });
      }
    }
    if (v.kind === "supplier_invoice") {
      if (!v.reference_number || !v.reference_number.trim()) {
        ctx.addIssue({
          path: ["reference_number"],
          code: z.ZodIssueCode.custom,
          message: "Invoice number is required",
        });
      }
    }
  });

export type TransactionValues = z.input<typeof transactionSchema>;
export type TransactionOutput = z.output<typeof transactionSchema>;
export const TRANSACTION_KIND_SCHEMA = z.enum(TRANSACTION_KINDS);
