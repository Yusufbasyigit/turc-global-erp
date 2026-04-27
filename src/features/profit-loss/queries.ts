"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { createClient } from "@/lib/supabase/client";
import {
  listTransactions,
  transactionKeys,
  type TransactionWithRelations,
} from "@/features/transactions/queries";
import { listFxSnapshots, treasuryKeys } from "@/features/treasury/queries";
import {
  istanbulYearMonth,
  shiftYearMonth,
} from "@/lib/proforma/istanbul-date";
import type {
  FxSnapshot,
  MonthlyFxOverride,
  TransactionKind,
} from "@/lib/supabase/types";

export const profitLossKeys = {
  all: ["profit-loss"] as const,
  overrides: () => [...profitLossKeys.all, "overrides"] as const,
};

const REVENUE_KINDS: readonly TransactionKind[] = [
  "shipment_billing",
  "order_billing",
  "other_income",
];

// `supplier_invoice` is intentionally NOT included: it represents an unpaid
// payable (balance-sheet liability), not a P&L expense. COGS for goods
// received via shipments is recognized at booking via `shipment_cogs`.
const EXPENSE_KINDS: readonly TransactionKind[] = [
  "expense",
  "other_expense",
  "shipment_cogs",
  "shipment_freight",
];

function isRevenue(k: string): boolean {
  return (REVENUE_KINDS as readonly string[]).includes(k);
}
function isExpense(k: string): boolean {
  return (EXPENSE_KINDS as readonly string[]).includes(k);
}

// Real estate has no billing event — the cash receipt IS the revenue moment.
// Export-side `client_payment`s are intentionally excluded to avoid
// double-counting against `order_billing` / `shipment_billing`.
function isRealEstateReceipt(t: TransactionWithRelations): boolean {
  if (t.kind !== "client_payment") return false;
  return t.real_estate_deal_id != null || t.revenue_source === "real_estate";
}

export type RowKind = "revenue" | "expense";

export type PandLRow = {
  id: string;
  date: string;
  kind: RowKind;
  rawKind: string;
  project: string;
  currency: string;
  amountNative: number;
  amountUsd: number | null;
};

export type RateSource = "override" | "snapshot" | "missing";

export type ResolvedRate = {
  value: number | null;
  displayPerUsd: number | null;
  source: RateSource;
  asOf: string | null;
  stale: boolean;
};

export type Totals = {
  revenueUsd: number;
  expenseUsd: number;
  netUsd: number;
  revenueTry: number;
  expenseTry: number;
  netTry: number;
  // Split of revenueUsd / revenueTry by business line. Rule:
  //   real_estate_deal_id != null  → real_estate
  //   revenue_source = 'real_estate' → real_estate
  //   revenue_source = 'export'      → export
  //   contact.type = 'real_estate' (and revenue_source is null) → real_estate
  //   else → export (catch-all so totals reconcile)
  revenueRealEstateUsd: number;
  revenueExportUsd: number;
  revenueRealEstateTry: number;
  revenueExportTry: number;
  hasUnconverted: boolean;
};

function classifyRevenueSource(t: TransactionWithRelations): "real_estate" | "export" {
  if (t.real_estate_deal_id) return "real_estate";
  if (t.revenue_source === "real_estate") return "real_estate";
  if (t.revenue_source === "export") return "export";
  if (t.contacts?.type === "real_estate") return "real_estate";
  return "export";
}

export type MonthlyPandL = {
  period: string;
  rate: ResolvedRate;
  rows: PandLRow[];
  totals: Totals;
  isLoading: boolean;
  isError: boolean;
};

export async function listMonthlyFxOverrides(): Promise<MonthlyFxOverride[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("monthly_fx_overrides")
    .select("*")
    .order("period", { ascending: false });
  if (error) {
    if (typeof console !== "undefined") {
      console.warn("monthly_fx_overrides query failed (returning []):", error);
    }
    return [];
  }
  return data ?? [];
}

export function resolveMonthlyRate(
  period: string,
  currency: string,
  overrides: MonthlyFxOverride[],
  snapshots: FxSnapshot[],
): ResolvedRate {
  const cur = currency.toUpperCase();

  const override = overrides.find(
    (o) => o.period === period && o.currency_code.toUpperCase() === cur,
  );
  if (override) {
    const rate = Number(override.rate_to_usd);
    return {
      value: rate,
      displayPerUsd: rate > 0 ? 1 / rate : null,
      source: "override",
      asOf: override.set_at,
      stale: false,
    };
  }

  const inMonth = snapshots
    .filter(
      (s) =>
        s.currency_code.toUpperCase() === cur &&
        istanbulYearMonth(s.snapshot_date) === period,
    )
    .sort((a, b) =>
      a.snapshot_date < b.snapshot_date
        ? 1
        : a.snapshot_date > b.snapshot_date
          ? -1
          : 0,
    );
  if (inMonth[0]) {
    const rate = Number(inMonth[0].rate_to_usd);
    return {
      value: rate,
      displayPerUsd: rate > 0 ? 1 / rate : null,
      source: "snapshot",
      asOf: inMonth[0].snapshot_date,
      stale: false,
    };
  }

  const beforeOrAt = snapshots
    .filter(
      (s) =>
        s.currency_code.toUpperCase() === cur &&
        istanbulYearMonth(s.snapshot_date) <= period,
    )
    .sort((a, b) =>
      a.snapshot_date < b.snapshot_date
        ? 1
        : a.snapshot_date > b.snapshot_date
          ? -1
          : 0,
    );
  if (beforeOrAt[0]) {
    const rate = Number(beforeOrAt[0].rate_to_usd);
    return {
      value: rate,
      displayPerUsd: rate > 0 ? 1 / rate : null,
      source: "snapshot",
      asOf: beforeOrAt[0].snapshot_date,
      stale: true,
    };
  }

  return {
    value: null,
    displayPerUsd: null,
    source: "missing",
    asOf: null,
    stale: false,
  };
}

function projectLabel(t: TransactionWithRelations): string {
  if (t.description?.trim()) return t.description.trim();
  if (t.expense_types?.name) return t.expense_types.name;
  if (t.contacts?.company_name) return t.contacts.company_name;
  if (t.partners?.name) return t.partners.name;
  if (t.from_account?.account_name) return t.from_account.account_name;
  if (t.to_account?.account_name) return t.to_account.account_name;
  return t.kind.replace(/_/g, " ");
}

export function useMonthlyPandL(period: string): MonthlyPandL {
  const {
    data: txData,
    isLoading: txLoading,
    isError: txError,
  } = useQuery({
    queryKey: transactionKeys.list(),
    queryFn: listTransactions,
  });
  const {
    data: fxData,
    isLoading: fxLoading,
    isError: fxError,
  } = useQuery({
    queryKey: treasuryKeys.fx(),
    queryFn: listFxSnapshots,
  });
  const {
    data: overrideData,
    isLoading: overrideLoading,
    isError: overrideError,
  } = useQuery({
    queryKey: profitLossKeys.overrides(),
    queryFn: listMonthlyFxOverrides,
  });

  return useMemo<MonthlyPandL>(() => {
    const isLoading = txLoading || fxLoading || overrideLoading;
    const isError = txError || fxError || overrideError;

    const empty: MonthlyPandL = {
      period,
      rate: {
        value: null,
        displayPerUsd: null,
        source: "missing",
        asOf: null,
        stale: false,
      },
      rows: [],
      totals: {
        revenueUsd: 0,
        expenseUsd: 0,
        netUsd: 0,
        revenueTry: 0,
        expenseTry: 0,
        netTry: 0,
        revenueRealEstateUsd: 0,
        revenueExportUsd: 0,
        revenueRealEstateTry: 0,
        revenueExportTry: 0,
        hasUnconverted: false,
      },
      isLoading,
      isError,
    };
    if (isLoading || isError) return empty;

    const snapshots = fxData ?? [];
    const overrides = overrideData ?? [];
    const rate = resolveMonthlyRate(period, "TRY", overrides, snapshots);

    const rows: PandLRow[] = [];
    let revenueUsd = 0;
    let expenseUsd = 0;
    let revenueTry = 0;
    let expenseTry = 0;
    let revenueRealEstateUsd = 0;
    let revenueExportUsd = 0;
    let revenueRealEstateTry = 0;
    let revenueExportTry = 0;
    let hasUnconverted = false;

    for (const t of txData ?? []) {
      if (istanbulYearMonth(t.transaction_date) !== period) continue;

      let rowKind: RowKind | null = null;
      if (isRevenue(t.kind)) rowKind = "revenue";
      else if (isExpense(t.kind)) rowKind = "expense";
      else if (isRealEstateReceipt(t)) rowKind = "revenue";
      if (!rowKind) continue;

      const native = Number(t.amount);
      const cur = t.currency.toUpperCase();

      let usd: number | null = null;
      if (cur === "USD") {
        usd = native;
      } else if (cur === "TRY") {
        if (rate.value) usd = native * rate.value;
      } else {
        // Other currencies: not auto-converted. Surface as null so the table
        // shows "—" with a tooltip rather than silently zeroing.
        hasUnconverted = true;
      }

      if (cur === "TRY") {
        if (rowKind === "revenue") revenueTry += native;
        else expenseTry += native;
      }
      if (usd != null) {
        if (rowKind === "revenue") revenueUsd += usd;
        else expenseUsd += usd;
      }
      if (rowKind === "revenue") {
        const src = classifyRevenueSource(t);
        if (cur === "TRY") {
          if (src === "real_estate") revenueRealEstateTry += native;
          else revenueExportTry += native;
        }
        if (usd != null) {
          if (src === "real_estate") revenueRealEstateUsd += usd;
          else revenueExportUsd += usd;
        }
      }

      rows.push({
        id: t.id,
        date: t.transaction_date,
        kind: rowKind,
        rawKind: t.kind,
        project: projectLabel(t),
        currency: cur,
        amountNative: native,
        amountUsd: usd,
      });
    }

    rows.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === "revenue" ? -1 : 1;
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      return a.id < b.id ? -1 : 1;
    });

    return {
      period,
      rate,
      rows,
      totals: {
        revenueUsd,
        expenseUsd,
        netUsd: revenueUsd - expenseUsd,
        revenueTry,
        expenseTry,
        netTry: revenueTry - expenseTry,
        revenueRealEstateUsd,
        revenueExportUsd,
        revenueRealEstateTry,
        revenueExportTry,
        hasUnconverted,
      },
      isLoading: false,
      isError: false,
    };
  }, [
    period,
    txData,
    txLoading,
    txError,
    fxData,
    fxLoading,
    fxError,
    overrideData,
    overrideLoading,
    overrideError,
  ]);
}

export type TrendPoint = {
  period: string;
  netUsd: number | null;
};

export type Trend = {
  points: TrendPoint[];
  isLoading: boolean;
  isError: boolean;
};

export function useNetPandLTrend(periods: number = 12, anchor?: string): Trend {
  const {
    data: txData,
    isLoading: txLoading,
    isError: txError,
  } = useQuery({
    queryKey: transactionKeys.list(),
    queryFn: listTransactions,
  });
  const {
    data: fxData,
    isLoading: fxLoading,
    isError: fxError,
  } = useQuery({
    queryKey: treasuryKeys.fx(),
    queryFn: listFxSnapshots,
  });
  const {
    data: overrideData,
    isLoading: overrideLoading,
    isError: overrideError,
  } = useQuery({
    queryKey: profitLossKeys.overrides(),
    queryFn: listMonthlyFxOverrides,
  });

  return useMemo<Trend>(() => {
    if (txLoading || fxLoading || overrideLoading) {
      return { points: [], isLoading: true, isError: false };
    }
    if (txError || fxError || overrideError) {
      return { points: [], isLoading: false, isError: true };
    }

    const end = anchor ?? istanbulYearMonth(new Date());
    const list: string[] = [];
    for (let i = periods - 1; i >= 0; i -= 1) {
      list.push(shiftYearMonth(end, -i));
    }

    const snapshots = fxData ?? [];
    const overrides = overrideData ?? [];

    const buckets = new Map<string, { rev: number; exp: number; convertible: boolean }>();
    const tryRateByPeriod = new Map<string, number | null>();
    for (const p of list) {
      buckets.set(p, { rev: 0, exp: 0, convertible: true });
      tryRateByPeriod.set(p, resolveMonthlyRate(p, "TRY", overrides, snapshots).value);
    }

    for (const t of txData ?? []) {
      const p = istanbulYearMonth(t.transaction_date);
      const bucket = buckets.get(p);
      if (!bucket) continue;
      const isRev = isRevenue(t.kind) || isRealEstateReceipt(t);
      const isExp = isExpense(t.kind);
      if (!isRev && !isExp) continue;

      const native = Number(t.amount);
      const cur = t.currency.toUpperCase();
      let usd: number | null = null;
      if (cur === "USD") {
        usd = native;
      } else if (cur === "TRY") {
        const rate = tryRateByPeriod.get(p) ?? null;
        if (rate) usd = native * rate;
        else bucket.convertible = false;
      } else {
        bucket.convertible = false;
      }

      if (usd != null) {
        if (isRev) bucket.rev += usd;
        else bucket.exp += usd;
      }
    }

    const points: TrendPoint[] = list.map((p) => {
      const b = buckets.get(p)!;
      return {
        period: p,
        netUsd: b.convertible ? b.rev - b.exp : null,
      };
    });

    return { points, isLoading: false, isError: false };
  }, [
    periods,
    anchor,
    txData,
    txLoading,
    txError,
    fxData,
    fxLoading,
    fxError,
    overrideData,
    overrideLoading,
    overrideError,
  ]);
}
