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
  "other_income",
];

// `supplier_invoice` is intentionally NOT included: it represents an unpaid
// payable (balance-sheet liability), not a P&L expense. COGS for goods
// received via shipments is recognized at booking via `shipment_cogs`.
const EXPENSE_KINDS: readonly TransactionKind[] = [
  "expense",
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
// double-counting against `shipment_billing`.
function isRealEstateReceipt(t: TransactionWithRelations): boolean {
  if (t.kind !== "client_payment") return false;
  return t.real_estate_deal_id != null;
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
  // Split of revenueUsd / revenueTry by business line: a client_payment is
  // real-estate revenue iff `real_estate_deal_id` is set; otherwise export.
  revenueRealEstateUsd: number;
  revenueExportUsd: number;
  revenueRealEstateTry: number;
  revenueExportTry: number;
  hasUnconverted: boolean;
};

export type MonthAggregate = {
  totals: Totals;
  rate: ResolvedRate;
  hasMissingRate: boolean;
};

export function emptyTotals(): Totals {
  return {
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
  };
}

export function addTotals(a: Totals, b: Totals): Totals {
  return {
    revenueUsd: a.revenueUsd + b.revenueUsd,
    expenseUsd: a.expenseUsd + b.expenseUsd,
    netUsd: a.netUsd + b.netUsd,
    revenueTry: a.revenueTry + b.revenueTry,
    expenseTry: a.expenseTry + b.expenseTry,
    netTry: a.netTry + b.netTry,
    revenueRealEstateUsd: a.revenueRealEstateUsd + b.revenueRealEstateUsd,
    revenueExportUsd: a.revenueExportUsd + b.revenueExportUsd,
    revenueRealEstateTry: a.revenueRealEstateTry + b.revenueRealEstateTry,
    revenueExportTry: a.revenueExportTry + b.revenueExportTry,
    hasUnconverted: a.hasUnconverted || b.hasUnconverted,
  };
}

function classifyRevenueSource(t: TransactionWithRelations): "real_estate" | "export" {
  return t.real_estate_deal_id ? "real_estate" : "export";
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

export function aggregateMonthlyTotals(
  period: string,
  transactions: TransactionWithRelations[],
  snapshots: FxSnapshot[],
  overrides: MonthlyFxOverride[],
): MonthAggregate {
  const tryRate = resolveMonthlyRate(period, "TRY", overrides, snapshots);
  const totals = emptyTotals();

  // Cache per-currency rate lookups. The headline `rate` returned to the
  // banner stays TRY, but conversion now uses the row's own currency so
  // EUR/GBP/etc. roll into USD totals instead of silently dropping out.
  const rateCache = new Map<string, ResolvedRate>([["TRY", tryRate]]);
  function rateFor(cur: string): ResolvedRate {
    let r = rateCache.get(cur);
    if (!r) {
      r = resolveMonthlyRate(period, cur, overrides, snapshots);
      rateCache.set(cur, r);
    }
    return r;
  }

  for (const t of transactions) {
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
    } else {
      const r = rateFor(cur);
      if (r.value != null) usd = native * r.value;
      else totals.hasUnconverted = true;
    }

    if (cur === "TRY") {
      if (rowKind === "revenue") totals.revenueTry += native;
      else totals.expenseTry += native;
    }
    if (usd != null) {
      if (rowKind === "revenue") totals.revenueUsd += usd;
      else totals.expenseUsd += usd;
    }
    if (rowKind === "revenue") {
      const src = classifyRevenueSource(t);
      if (cur === "TRY") {
        if (src === "real_estate") totals.revenueRealEstateTry += native;
        else totals.revenueExportTry += native;
      }
      if (usd != null) {
        if (src === "real_estate") totals.revenueRealEstateUsd += usd;
        else totals.revenueExportUsd += usd;
      }
    }
  }

  totals.netUsd = totals.revenueUsd - totals.expenseUsd;
  totals.netTry = totals.revenueTry - totals.expenseTry;

  // A month is "missing rate" when there is at least one TRY transaction
  // and no resolvable USD/TRY rate. Pure USD-only months are NOT missing.
  const hasTry =
    totals.revenueTry > 0 ||
    totals.expenseTry > 0;
  const hasMissingRate = hasTry && tryRate.value == null;

  return { totals, rate: tryRate, hasMissingRate };
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
      totals: emptyTotals(),
      isLoading,
      isError,
    };
    if (isLoading || isError) return empty;

    const snapshots = fxData ?? [];
    const overrides = overrideData ?? [];
    const transactions = txData ?? [];

    const { totals, rate } = aggregateMonthlyTotals(
      period,
      transactions,
      snapshots,
      overrides,
    );

    const rows: PandLRow[] = [];
    const rowRateCache = new Map<string, number | null>([
      ["TRY", rate.value],
    ]);
    function rowRateValue(cur: string): number | null {
      if (rowRateCache.has(cur)) return rowRateCache.get(cur) ?? null;
      const v = resolveMonthlyRate(period, cur, overrides, snapshots).value;
      rowRateCache.set(cur, v);
      return v;
    }
    for (const t of transactions) {
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
      } else {
        const r = rowRateValue(cur);
        if (r) usd = native * r;
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
      totals,
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
    for (const p of list) {
      buckets.set(p, { rev: 0, exp: 0, convertible: true });
    }
    // Cache rate lookups by (period, currency) so a 12-month trend doesn't
    // re-resolve EUR/GBP/... once per row.
    const rateByPeriodCurrency = new Map<string, number | null>();
    function rateValueFor(period: string, cur: string): number | null {
      const key = `${period}|${cur}`;
      if (rateByPeriodCurrency.has(key)) {
        return rateByPeriodCurrency.get(key) ?? null;
      }
      const v = resolveMonthlyRate(period, cur, overrides, snapshots).value;
      rateByPeriodCurrency.set(key, v);
      return v;
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
      } else {
        const rate = rateValueFor(p, cur);
        if (rate) usd = native * rate;
        else bucket.convertible = false;
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

export type PeriodTotals = {
  totalsByMonth: Map<string, Totals>;
  missingRateMonths: Set<string>;
  isLoading: boolean;
  isError: boolean;
};

export function usePeriodTotals(periods: string[]): PeriodTotals {
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

  const periodsKey = periods.join(",");

  return useMemo<PeriodTotals>(() => {
    const isLoading = txLoading || fxLoading || overrideLoading;
    const isError = txError || fxError || overrideError;
    if (isLoading || isError) {
      return {
        totalsByMonth: new Map(),
        missingRateMonths: new Set(),
        isLoading,
        isError,
      };
    }
    const transactions = txData ?? [];
    const snapshots = fxData ?? [];
    const overrides = overrideData ?? [];

    const totalsByMonth = new Map<string, Totals>();
    const missingRateMonths = new Set<string>();
    for (const p of periods) {
      const agg = aggregateMonthlyTotals(p, transactions, snapshots, overrides);
      totalsByMonth.set(p, agg.totals);
      if (agg.hasMissingRate) missingRateMonths.add(p);
    }
    return { totalsByMonth, missingRateMonths, isLoading: false, isError: false };
    // periodsKey is a stable string hash of `periods`; using it avoids
    // re-running on every render when the caller passes a new array identity
    // with identical contents (e.g. `quartersOfYear(year)`).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    periodsKey,
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

export type TrendBucket = {
  key: string;
  label: string;
  months: string[];
};

export type LabeledTrendPoint = {
  key: string;
  label: string;
  netUsd: number | null;
};

export type LabeledTrend = {
  points: LabeledTrendPoint[];
  isLoading: boolean;
  isError: boolean;
};

export function useNetPandLTrendBuckets(buckets: TrendBucket[]): LabeledTrend {
  const allMonths = useMemo(() => {
    const seen = new Set<string>();
    for (const b of buckets) for (const m of b.months) seen.add(m);
    return Array.from(seen);
  }, [buckets]);

  const periodTotals = usePeriodTotals(allMonths);

  return useMemo<LabeledTrend>(() => {
    if (periodTotals.isLoading) {
      return { points: [], isLoading: true, isError: false };
    }
    if (periodTotals.isError) {
      return { points: [], isLoading: false, isError: true };
    }

    const points: LabeledTrendPoint[] = buckets.map((b) => {
      let net = 0;
      let convertible = true;
      for (const m of b.months) {
        const t = periodTotals.totalsByMonth.get(m);
        if (!t) {
          convertible = false;
          break;
        }
        if (periodTotals.missingRateMonths.has(m) || t.hasUnconverted) {
          convertible = false;
        }
        net += t.netUsd;
      }
      return {
        key: b.key,
        label: b.label,
        netUsd: convertible ? net : null,
      };
    });

    return { points, isLoading: false, isError: false };
  }, [buckets, periodTotals]);
}
