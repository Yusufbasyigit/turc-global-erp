// Pure attention-rule functions for the dashboard.
//
// Each rule takes already-fetched data and returns a flat list of
// AttentionItem. No I/O, no React Query, no DB. The dashboard's
// AttentionList composes the three rule outputs and renders the rows.

import {
  istanbulYearMonth,
  shiftYearMonth,
  todayIsoDate,
} from "@/lib/proforma/istanbul-date";
import { istanbulToday, parseDateLocal } from "@/lib/format-date";
import { formatCurrency } from "@/lib/format-money";
import type { KdvMonth } from "@/lib/ledger/kdv-summary";
import type { ShipmentListRow } from "@/features/shipments/queries";
import type { PartnerPendingSummary } from "@/features/partners/queries/pending-reimbursements";
import type { OverdueInstallmentRow } from "@/features/real-estate/queries";

export type AttentionSeverity = "red" | "amber";

export type AttentionItem = {
  id: string;
  severity: AttentionSeverity;
  label: string;
  entity: string;
  href: string;
  age: string;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const REIMBURSEMENT_AGE_DAYS = 30;

function ageInDays(fromIso: string, toIso: string): number | null {
  const from = parseDateLocal(fromIso);
  const to = parseDateLocal(toIso);
  if (!from || !to) return null;
  return Math.floor((to.getTime() - from.getTime()) / MS_PER_DAY);
}

function formatAgeDays(days: number): string {
  if (days <= 0) return "today";
  if (days === 1) return "1 day";
  return `${days} days`;
}

// Rule 1 — Red: shipment status === "in_transit" AND eta_date < today.
export function shipmentEtaPastDueRule(
  shipments: ShipmentListRow[],
  todayIso: string = todayIsoDate(),
): AttentionItem[] {
  const items: AttentionItem[] = [];
  for (const s of shipments) {
    if (s.status !== "in_transit") continue;
    if (!s.eta_date) continue;
    if (s.eta_date >= todayIso) continue;
    const days = ageInDays(s.eta_date, todayIso) ?? 0;
    items.push({
      id: `shipment-eta-${s.id}`,
      severity: "red",
      label: "Past ETA",
      entity: s.name ?? "(unnamed)",
      href: `/shipments/${s.id}`,
      age: `${formatAgeDays(days)} late`,
    });
  }
  return items;
}

// Rule 2 — Red: KDV unfiled past the 26th of M+1 (Beyanname deadline).
//
// For each month M from 13 months ago through the previous full month: if
// summarizeKdv shows non-zero net VAT for M and M is unfiled AND today is
// past the 26th of M+1, flag it.
export function kdvUnfiledRule(
  periods: KdvMonth[],
  now: Date = new Date(),
): AttentionItem[] {
  const currentPeriod = istanbulYearMonth(now);
  const today = istanbulToday(now);
  const items: AttentionItem[] = [];
  for (const p of periods) {
    if (p.period === currentPeriod) continue;
    if (p.status === "filed") continue;
    if (Math.abs(p.net_try) <= 0.001) continue;
    const deadline = `${shiftYearMonth(p.period, 1)}-26`;
    if (today <= deadline) continue;
    const days = ageInDays(deadline, today) ?? 0;
    items.push({
      id: `kdv-unfiled-${p.period}`,
      severity: "red",
      label: "KDV unfiled",
      entity: p.period,
      href: "/tax",
      age: `${formatAgeDays(days)} past Beyanname`,
    });
  }
  return items;
}

// Rule 3 — Amber: any pending partner reimbursement claim older than 30 days.
// One row per partner; show the oldest open claim's age.
export function oldPartnerReimbursementRule(
  partners: PartnerPendingSummary[],
  todayIso: string = todayIsoDate(),
): AttentionItem[] {
  const items: AttentionItem[] = [];
  for (const row of partners) {
    let oldestDate: string | null = null;
    let oldestAmount = 0;
    let oldestCurrency: string | null = null;
    for (const bucket of row.pending) {
      if (!bucket.oldest_open_claim_date) continue;
      const age = ageInDays(bucket.oldest_open_claim_date, todayIso);
      if (age === null || age <= REIMBURSEMENT_AGE_DAYS) continue;
      if (!oldestDate || bucket.oldest_open_claim_date < oldestDate) {
        oldestDate = bucket.oldest_open_claim_date;
        oldestAmount = bucket.oldest_open_claim_amount;
        oldestCurrency = bucket.currency;
      }
    }
    if (!oldestDate || !oldestCurrency) continue;
    const days = ageInDays(oldestDate, todayIso) ?? 0;
    items.push({
      id: `partner-reimbursement-${row.partner.id}`,
      severity: "amber",
      label: "Reimbursement >30d",
      entity: `${row.partner.name} — ${formatCurrency(oldestAmount, oldestCurrency)}`,
      href: "/partners",
      age: `${formatAgeDays(days)} old`,
    });
  }
  return items;
}

// Rule 4 — Red: real-estate installment overdue by more than 7 days.
// Tighter threshold than partner reimbursements because rent slips faster.
export function realEstateOverdueRule(
  rows: OverdueInstallmentRow[],
): AttentionItem[] {
  const items: AttentionItem[] = [];
  for (const r of rows) {
    items.push({
      id: `re-installment-${r.installment_id}`,
      severity: "red",
      label: "Real estate overdue",
      entity: `${r.deal_label} — ${formatCurrency(r.outstanding, r.currency)}`,
      href: "/real-estate",
      age: `${formatAgeDays(r.days_overdue)} late`,
    });
  }
  return items;
}

// Helper for components/tests that want a single-line message.
export function attentionItemLine(item: AttentionItem): string {
  return `${item.label} — ${item.entity} · ${item.age}`;
}
