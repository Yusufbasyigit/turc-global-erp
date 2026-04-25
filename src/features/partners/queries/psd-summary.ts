import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { istanbulYearMonth } from "@/lib/proforma/istanbul-date";

export type PsdRow = {
  year: number;
  month: number;
  currency: string;
  amount: number;
};

export type PsdAggregateInput = {
  transaction_date: string;
  currency: string;
  amount: number | string;
};

export function aggregatePsd(rows: PsdAggregateInput[]): PsdRow[] {
  const map = new Map<string, PsdRow>();
  for (const r of rows) {
    const ym = istanbulYearMonth(r.transaction_date);
    const [yStr, mStr] = ym.split("-");
    const year = Number(yStr);
    const month = Number(mStr);
    const key = `${year}-${month}-${r.currency}`;
    const amt = Number(r.amount);
    if (!Number.isFinite(amt)) continue;
    const existing = map.get(key);
    if (existing) {
      existing.amount += amt;
    } else {
      map.set(key, { year, month, currency: r.currency, amount: amt });
    }
  }
  return Array.from(map.values()).sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    if (a.month !== b.month) return a.month - b.month;
    return a.currency.localeCompare(b.currency);
  });
}

export async function listPsdSummary({
  yearFrom,
  yearTo,
}: {
  yearFrom: number;
  yearTo: number;
}): Promise<PsdRow[]> {
  const supabase = createClient();
  const startIso = `${yearFrom}-01-01`;
  const endIso = `${yearTo}-12-31`;

  const { data, error } = await supabase
    .from("transactions")
    .select("transaction_date, currency, amount")
    .eq("kind", "profit_distribution")
    .gte("transaction_date", startIso)
    .lte("transaction_date", endIso);
  if (error) throw error;

  return aggregatePsd((data ?? []) as PsdAggregateInput[]);
}

export async function listPsdYearTotal(year: number): Promise<
  { currency: string; amount: number }[]
> {
  const rows = await listPsdSummary({ yearFrom: year, yearTo: year });
  const byCurrency = new Map<string, number>();
  for (const r of rows) {
    byCurrency.set(r.currency, (byCurrency.get(r.currency) ?? 0) + r.amount);
  }
  return Array.from(byCurrency.entries())
    .map(([currency, amount]) => ({ currency, amount }))
    .sort((a, b) => a.currency.localeCompare(b.currency));
}

export const psdKeys = {
  all: ["partner-psd"] as const,
  summary: (yearFrom: number, yearTo: number) =>
    [...psdKeys.all, "summary", yearFrom, yearTo] as const,
  yearTotal: (year: number) => [...psdKeys.all, "year", year] as const,
};

export function usePsdSummary({
  yearFrom,
  yearTo,
}: {
  yearFrom: number;
  yearTo: number;
}) {
  return useQuery({
    queryKey: psdKeys.summary(yearFrom, yearTo),
    queryFn: () => listPsdSummary({ yearFrom, yearTo }),
  });
}

export function usePsdYearTotal(year: number) {
  return useQuery({
    queryKey: psdKeys.yearTotal(year),
    queryFn: () => listPsdYearTotal(year),
  });
}
