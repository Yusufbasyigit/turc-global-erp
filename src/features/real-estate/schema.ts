import { z } from "zod";
import {
  BALANCE_CURRENCIES,
  REAL_ESTATE_SUB_TYPES,
} from "@/lib/supabase/types";

const dateString = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date");

const positiveAmount = z.preprocess(
  (v) => {
    if (v === "" || v === null || v === undefined) return undefined;
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : NaN;
  },
  z.number({ error: "Must be a number" }).positive("Must be greater than zero"),
);

export const installmentSchema = z.object({
  id: z.string().optional(),
  due_date: dateString,
  expected_amount: positiveAmount,
});

export const dealFormSchema = z.object({
  label: z.string().trim().min(1, "Label is required"),
  sub_type: z.enum(REAL_ESTATE_SUB_TYPES),
  contact_id: z.string().trim().min(1, "Pick a contact"),
  currency: z.enum(BALANCE_CURRENCIES),
  start_date: dateString,
  notes: z.string().optional().default(""),
  installments: z.array(installmentSchema).min(1, "Add at least one installment"),
});

export const receiptFormSchema = z.object({
  deal_id: z.string().trim().min(1, "Pick a deal"),
  transaction_date: dateString,
  amount: positiveAmount,
  to_account_id: z.string().trim().min(1, "Pick a destination account"),
  description: z.string().optional().default(""),
});

export type DealFormValues = z.input<typeof dealFormSchema>;
export type DealFormOutput = z.output<typeof dealFormSchema>;
export type ReceiptFormValues = z.input<typeof receiptFormSchema>;
export type ReceiptFormOutput = z.output<typeof receiptFormSchema>;
