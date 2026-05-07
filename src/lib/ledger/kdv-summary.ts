import type { TransactionKind } from "@/lib/supabase/types";
import {
  istanbulYearMonth,
  shiftYearMonth,
} from "@/lib/proforma/istanbul-date";

// Pure KDV (Turkish VAT) reconciliation engine.
//
// Mirrors allocateFifo / allocatePartnerReimbursements: pure, no DB, no
// fetches, recomputed on every render. The only persisted link between a
// period and its filing is transactions.kdv_period on tax_payment rows.
//
// Tie-break for multiple tax_payment rows matching the same period: newest
// transaction_date DESC, then most recent created_time DESC. (The id is a
// UUID so it can't be used as a recency proxy; created_time is monotonic
// and serves the same purpose without the lexicographic-UUID pitfall.)

export const VAT_COLLECTED_KINDS: readonly TransactionKind[] = [
  "shipment_billing",
  "other_income",
];

export const VAT_PAID_KINDS: readonly TransactionKind[] = [
  "supplier_invoice",
  "expense",
];

export type KdvInputTxn = {
  id: string;
  transaction_date: string;
  // Used only as a tie-breaker when two tax_payment rows fall on the same
  // transaction_date — kept optional so scripts and tests that don't care
  // about ordering can omit it.
  created_time?: string | null;
  kind: TransactionKind;
  currency: string;
  vat_amount: number | null;
  kdv_period: string | null;
  reference_number: string | null;
};

export type KdvMonth = {
  period: string;
  collected_vat_try: number;
  paid_vat_try: number;
  net_try: number;
  status: "filed" | "unfiled";
  linked_payment_id: string | null;
  linked_payment_reference: string | null;
  skipped_count: number;
};

function isCollected(kind: TransactionKind): boolean {
  return VAT_COLLECTED_KINDS.includes(kind);
}

function isPaid(kind: TransactionKind): boolean {
  return VAT_PAID_KINDS.includes(kind);
}

export function summarizeKdv(
  txns: KdvInputTxn[],
  monthsBack: number = 12,
  now: Date = new Date(),
): KdvMonth[] {
  const currentPeriod = istanbulYearMonth(now);
  const periods: string[] = [];
  for (let i = 0; i < monthsBack; i += 1) {
    periods.push(shiftYearMonth(currentPeriod, -i));
  }

  const byPeriod = new Map<
    string,
    { collected: number; paid: number; skipped: number }
  >();
  for (const p of periods) byPeriod.set(p, { collected: 0, paid: 0, skipped: 0 });

  const paymentsByPeriod = new Map<string, KdvInputTxn[]>();

  for (const t of txns) {
    if (t.kind === "tax_payment") {
      if (!t.kdv_period) continue;
      if (!byPeriod.has(t.kdv_period)) continue;
      const list = paymentsByPeriod.get(t.kdv_period) ?? [];
      list.push(t);
      paymentsByPeriod.set(t.kdv_period, list);
      continue;
    }

    const collects = isCollected(t.kind);
    const pays = isPaid(t.kind);
    if (!collects && !pays) continue;
    if (t.vat_amount == null) continue;

    const period = istanbulYearMonth(t.transaction_date);
    const bucket = byPeriod.get(period);
    if (!bucket) continue;

    if (t.currency !== "TRY") {
      bucket.skipped += 1;
      continue;
    }

    const amt = Number(t.vat_amount);
    if (collects) bucket.collected += amt;
    else bucket.paid += amt;
  }

  return periods.map((period) => {
    const b = byPeriod.get(period)!;
    const payments = paymentsByPeriod.get(period) ?? [];
    payments.sort((a, b2) => {
      if (a.transaction_date !== b2.transaction_date) {
        return a.transaction_date < b2.transaction_date ? 1 : -1;
      }
      const ac = a.created_time ?? "";
      const bc = b2.created_time ?? "";
      if (ac !== bc) return ac < bc ? 1 : -1;
      // Final stable fallback if created_time is also tied — string compare
      // on id keeps sort deterministic without claiming UUID ordering means
      // anything semantically.
      return a.id < b2.id ? 1 : -1;
    });
    const linked = payments[0] ?? null;
    return {
      period,
      collected_vat_try: round2(b.collected),
      paid_vat_try: round2(b.paid),
      net_try: round2(b.collected - b.paid),
      status: linked ? "filed" : "unfiled",
      linked_payment_id: linked?.id ?? null,
      linked_payment_reference: linked?.reference_number ?? null,
      skipped_count: b.skipped,
    };
  });
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function formatPeriodLabel(period: string): string {
  const [y, m] = period.split("-");
  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const idx = Number(m) - 1;
  if (!y || !Number.isInteger(idx) || idx < 0 || idx > 11) return period;
  return `${monthNames[idx]} ${y}`;
}
