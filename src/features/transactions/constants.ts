import type { TransactionKind } from "@/lib/supabase/types";

export const TRANSACTION_KIND_LABELS: Record<TransactionKind, string> = {
  client_payment: "Client payment",
  client_refund: "Client refund",
  supplier_payment: "Supplier payment",
  supplier_invoice: "Supplier invoice",
  expense: "Expense",
  other_income: "Other income",
  partner_loan_in: "Partner loan in",
  partner_loan_out: "Partner loan out",
  profit_distribution: "Profit distribution",
  tax_payment: "Tax payment",
  shipment_billing: "Shipment billing",
  shipment_cogs: "Shipment COGS",
  shipment_freight: "Shipment freight",
};

export const TRANSACTION_KIND_DESCRIPTIONS: Record<TransactionKind, string> = {
  client_payment: "Cash received from a customer.",
  client_refund: "Money returned to a customer.",
  supplier_payment: "Cash paid to a supplier.",
  supplier_invoice: "Invoice booked, not yet paid.",
  expense: "Operating expense paid by the business or a partner.",
  other_income: "Non-operating income.",
  partner_loan_in: "Partner lent money to the business.",
  partner_loan_out: "Business lent money to a partner.",
  profit_distribution: "Distribution of profit to a partner.",
  tax_payment: "Tax payment to government.",
  shipment_billing: "Shipment was billed to a customer (accrual).",
  shipment_cogs: "Cost of goods recognized at shipment booking (accrual).",
  shipment_freight: "Freight cost recognized at shipment booking (accrual).",
};

export const TRANSACTION_KIND_BADGE_CLASSES: Record<TransactionKind, string> = {
  client_payment:
    "border-transparent bg-emerald-500/15 text-emerald-800 hover:bg-emerald-500/25",
  client_refund:
    "border-transparent bg-amber-500/20 text-amber-800 hover:bg-amber-500/30",
  supplier_payment:
    "border-transparent bg-rose-500/15 text-rose-800 hover:bg-rose-500/25",
  supplier_invoice:
    "border-transparent bg-zinc-500/15 text-zinc-700 hover:bg-zinc-500/25",
  expense:
    "border-transparent bg-rose-500/15 text-rose-800 hover:bg-rose-500/25",
  other_income:
    "border-transparent bg-emerald-500/15 text-emerald-800 hover:bg-emerald-500/25",
  partner_loan_in:
    "border-transparent bg-sky-500/15 text-sky-800 hover:bg-sky-500/25",
  partner_loan_out:
    "border-transparent bg-sky-500/15 text-sky-800 hover:bg-sky-500/25",
  profit_distribution:
    "border-transparent bg-violet-500/15 text-violet-800 hover:bg-violet-500/25",
  tax_payment:
    "border-transparent bg-orange-500/20 text-orange-800 hover:bg-orange-500/30",
  shipment_billing:
    "border-transparent bg-zinc-500/15 text-zinc-700 hover:bg-zinc-500/25",
  shipment_cogs:
    "border-transparent bg-rose-500/15 text-rose-800 hover:bg-rose-500/25",
  shipment_freight:
    "border-transparent bg-rose-500/15 text-rose-800 hover:bg-rose-500/25",
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
  "partner_loan_out",
  "profit_distribution",
  "tax_payment",
];

export const ACCRUAL_KINDS: TransactionKind[] = [
  "supplier_invoice",
  "shipment_billing",
  "shipment_cogs",
  "shipment_freight",
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

// ---------------------------------------------------------------------------
// Kind picker tree — drives the 2-3 level wizard in the transaction dialog.
// `kinds` and `subCategories` are mutually exclusive per category.
// ---------------------------------------------------------------------------

export type KindCategoryId = "in" | "out" | "bills";
export type KindSubCategoryId = "operating" | "partner";

export type KindSubCategory = {
  id: KindSubCategoryId;
  label: string;
  description: string;
  kinds: TransactionKind[];
};

export type KindCategory = {
  id: KindCategoryId;
  label: string;
  description: string;
  kinds?: TransactionKind[];
  subCategories?: KindSubCategory[];
};

export const KIND_CATEGORIES: KindCategory[] = [
  {
    id: "in",
    label: "Money in",
    description: "Cash received by the business.",
    kinds: ["client_payment", "other_income", "partner_loan_in"],
  },
  {
    id: "out",
    label: "Money out",
    description: "Cash paid out by the business.",
    subCategories: [
      {
        id: "operating",
        label: "Operating",
        description: "Day-to-day: suppliers, expenses, refunds, taxes.",
        kinds: [
          "supplier_payment",
          "expense",
          "client_refund",
          "tax_payment",
        ],
      },
      {
        id: "partner",
        label: "Partner",
        description: "Partner loans and profit distributions.",
        kinds: ["partner_loan_out", "profit_distribution"],
      },
    ],
  },
  {
    id: "bills",
    label: "Bills (accruals)",
    description: "Invoices and accruals not yet paid.",
    kinds: [
      "supplier_invoice",
      "shipment_billing",
      "shipment_cogs",
      "shipment_freight",
    ],
  },
];

export function locateKind(k: TransactionKind): {
  category: KindCategoryId;
  sub: KindSubCategoryId | null;
} {
  for (const cat of KIND_CATEGORIES) {
    if (cat.kinds?.includes(k)) return { category: cat.id, sub: null };
    if (cat.subCategories) {
      for (const sub of cat.subCategories) {
        if (sub.kinds.includes(k)) return { category: cat.id, sub: sub.id };
      }
    }
  }
  throw new Error(`Unknown transaction kind: ${k}`);
}
