import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { istanbulYearMonth } from "@/lib/proforma/istanbul-date";
import type {
  Account,
  CustodyLocation,
  PsdEvent,
  Transaction,
} from "@/lib/supabase/types";

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
    .not("psd_event_id", "is", null)
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

export type PsdEventLeg = Pick<
  Transaction,
  "id" | "amount" | "currency" | "from_account_id" | "transaction_date"
> & {
  from_account:
    | (Pick<Account, "id" | "account_name" | "asset_code"> & {
        custody_locations: Pick<CustodyLocation, "id" | "name"> | null;
      })
    | null;
};

export type PsdEventWithLegs = PsdEvent & {
  legs: PsdEventLeg[];
};

const PSD_EVENT_SELECT = `
  *,
  legs:transactions!transactions_psd_event_id_fkey(
    id, amount, currency, from_account_id, transaction_date,
    from_account:accounts!transactions_from_account_id_fkey(
      id, account_name, asset_code,
      custody_locations:custody_locations!accounts_custody_location_id_fkey(id, name)
    )
  )
`;

export async function listPsdEvents({
  yearFrom,
  yearTo,
}: {
  yearFrom: number;
  yearTo: number;
}): Promise<PsdEventWithLegs[]> {
  const supabase = createClient();
  const startIso = `${yearFrom}-01-01`;
  const endIso = `${yearTo}-12-31`;
  const { data, error } = await supabase
    .from("psd_events")
    .select(PSD_EVENT_SELECT)
    .is("deleted_at", null)
    .gte("event_date", startIso)
    .lte("event_date", endIso)
    .order("event_date", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as PsdEventWithLegs[];
}

export const psdKeys = {
  all: ["partner-psd"] as const,
  summary: (yearFrom: number, yearTo: number) =>
    [...psdKeys.all, "summary", yearFrom, yearTo] as const,
  yearTotal: (year: number) => [...psdKeys.all, "year", year] as const,
  events: (yearFrom: number, yearTo: number) =>
    [...psdKeys.all, "events", yearFrom, yearTo] as const,
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

export function usePsdEvents({
  yearFrom,
  yearTo,
}: {
  yearFrom: number;
  yearTo: number;
}) {
  return useQuery({
    queryKey: psdKeys.events(yearFrom, yearTo),
    queryFn: () => listPsdEvents({ yearFrom, yearTo }),
  });
}
