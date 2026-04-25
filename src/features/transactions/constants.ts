import type { TransactionKind } from "@/lib/supabase/types";

export const TRANSACTION_KIND_LABELS: Record<TransactionKind, string> = {
  client_payment: "Client payment",
  client_refund: "Client refund",
  supplier_payment: "Supplier payment",
  supplier_invoice: "Supplier invoice",
  expense: "Expense",
  other_income: "Other income",
  other_expense: "Other expense",
  partner_loan_in: "Partner loan in",
  partner_loan_out: "Partner loan out",
  profit_distribution: "Profit distribution",
  tax_payment: "Tax payment",
  order_billing: "Order billing",
  shipment_billing: "Shipment billing",
  adjustment: "Adjustment",
};

export const TRANSACTION_KIND_DESCRIPTIONS: Record<TransactionKind, string> = {
  client_payment: "Cash received from a customer.",
  client_refund: "Money returned to a customer.",
  supplier_payment: "Cash paid to a supplier.",
  supplier_invoice: "Invoice booked, not yet paid.",
  expense: "Operating expense paid by the business or a partner.",
  other_income: "Non-operating income.",
  other_expense: "Non-operating expense.",
  partner_loan_in: "Partner lent money to the business.",
  partner_loan_out: "Business lent money to a partner.",
  profit_distribution: "Distribution of profit to a partner.",
  tax_payment: "Tax payment to government.",
  order_billing: "Order was billed to a customer (accrual).",
  shipment_billing: "Shipment was billed to a customer (accrual).",
  adjustment: "Bookkeeping adjustment.",
};

export const TRANSACTION_KIND_BADGE_CLASSES: Record<TransactionKind, string> = {
  client_payment:
    "border-transparent bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/20",
  client_refund:
    "border-transparent bg-amber-500/15 text-amber-300 hover:bg-amber-500/20",
  supplier_payment:
    "border-transparent bg-rose-500/15 text-rose-300 hover:bg-rose-500/20",
  supplier_invoice:
    "border-transparent bg-zinc-500/15 text-zinc-300 hover:bg-zinc-500/20",
  expense:
    "border-transparent bg-rose-500/15 text-rose-300 hover:bg-rose-500/20",
  other_income:
    "border-transparent bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/20",
  other_expense:
    "border-transparent bg-rose-500/15 text-rose-300 hover:bg-rose-500/20",
  partner_loan_in:
    "border-transparent bg-sky-500/15 text-sky-300 hover:bg-sky-500/20",
  partner_loan_out:
    "border-transparent bg-sky-500/15 text-sky-300 hover:bg-sky-500/20",
  profit_distribution:
    "border-transparent bg-violet-500/15 text-violet-300 hover:bg-violet-500/20",
  tax_payment:
    "border-transparent bg-orange-500/15 text-orange-300 hover:bg-orange-500/20",
  order_billing:
    "border-transparent bg-zinc-500/15 text-zinc-300 hover:bg-zinc-500/20",
  shipment_billing:
    "border-transparent bg-zinc-500/15 text-zinc-300 hover:bg-zinc-500/20",
  adjustment:
    "border-transparent bg-zinc-500/15 text-zinc-300 hover:bg-zinc-500/20",
};

export const CASH_IN_KINDS: TransactionKind[] = [
  "client_payment",
  "other_income",
  "partner_loan_in",
];

export const CASH_OUT_KINDS: TransactionKind[] = [
  "client_refund",
  "supplier_payment",
  "expense",
  "other_expense",
  "partner_loan_out",
  "profit_distribution",
  "tax_payment",
];

export const ACCRUAL_KINDS: TransactionKind[] = [
  "supplier_invoice",
  "order_billing",
  "shipment_billing",
  "adjustment",
];

export type SpawnDirection = "deposit" | "withdraw";

export const KIND_SPAWN_DIRECTION: Partial<
  Record<TransactionKind, SpawnDirection>
> = {
  client_payment: "deposit",
  client_refund: "withdraw",
  supplier_payment: "withdraw",
  expense: "withdraw",
  other_income: "deposit",
  other_expense: "withdraw",
  partner_loan_in: "deposit",
  partner_loan_out: "withdraw",
  profit_distribution: "withdraw",
  tax_payment: "withdraw",
};

export function kindSpawnsMovement(
  kind: TransactionKind,
  hasFromAccount: boolean,
  hasToAccount: boolean,
): boolean {
  const direction = KIND_SPAWN_DIRECTION[kind];
  if (!direction) return false;
  if (direction === "deposit") return hasToAccount;
  return hasFromAccount;
}
