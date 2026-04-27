import { useQuery } from "@tanstack/react-query";

import { createClient } from "@/lib/supabase/client";
import type {
  AccountWithCustody,
  CustodyLocation,
  FxSnapshot,
  PriceSnapshot,
  RateRefreshRun,
  TreasuryMovement,
} from "@/lib/supabase/types";

export const treasuryKeys = {
  all: ["treasury"] as const,
  accounts: () => [...treasuryKeys.all, "accounts"] as const,
  movements: () => [...treasuryKeys.all, "movements"] as const,
  custody: () => [...treasuryKeys.all, "custody"] as const,
  fx: () => [...treasuryKeys.all, "fx"] as const,
  prices: () => [...treasuryKeys.all, "prices"] as const,
  refreshRuns: () => [...treasuryKeys.all, "refreshRuns"] as const,
};

const ACCOUNT_SELECT = `
  *,
  custody_locations:custody_locations!accounts_custody_location_id_fkey(
    id, name, location_type, is_active, requires_movement_type
  )
`;

export async function listAccountsWithCustody(): Promise<AccountWithCustody[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("accounts")
    .select(ACCOUNT_SELECT)
    // Picker chokepoint: deactivated and soft-deleted accounts must not appear
    // in any new-transaction or new-movement picker. Display-only joins
    // (transaction list account names) resolve via FK regardless and are
    // unaffected.
    .is("deleted_at", null)
    .eq("is_active", true)
    .order("account_name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as AccountWithCustody[];
}

export async function listAllMovements(): Promise<TreasuryMovement[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("treasury_movements")
    .select("*")
    .order("movement_date", { ascending: false })
    .order("created_time", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function listCustodyLocations({
  activeOnly = false,
}: { activeOnly?: boolean } = {}): Promise<CustodyLocation[]> {
  const supabase = createClient();
  let q = supabase
    .from("custody_locations")
    .select("*")
    .order("name", { ascending: true });
  if (activeOnly) q = q.eq("is_active", true);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function listFxSnapshots(): Promise<FxSnapshot[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("fx_snapshots")
    .select("*")
    .order("fetched_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function listPriceSnapshots(): Promise<PriceSnapshot[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("price_snapshots")
    .select("*")
    .order("snapshot_date", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchLastRefreshRun(): Promise<RateRefreshRun | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("rate_refresh_runs")
    .select("*")
    .order("ran_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    // Table may not exist yet (migration pending), or the schema cache hasn't
    // picked it up yet. Either way, treat as "never run" rather than crashing
    // the Treasury header.
    if (typeof console !== "undefined") {
      console.warn("rate_refresh_runs query failed (returning null):", error);
    }
    return null;
  }
  return (data as RateRefreshRun | null) ?? null;
}

export function useLastRefreshRun() {
  return useQuery({
    queryKey: treasuryKeys.refreshRuns(),
    queryFn: fetchLastRefreshRun,
  });
}

export function computeBalanceMap(
  movements: TreasuryMovement[],
): Map<string, number> {
  const map = new Map<string, number>();
  for (const m of movements) {
    map.set(m.account_id, (map.get(m.account_id) ?? 0) + Number(m.quantity));
  }
  return map;
}

export function latestByKey<T>(
  rows: T[],
  keyFn: (r: T) => string,
  sortTsFn: (r: T) => string,
): Map<string, T> {
  const map = new Map<string, T>();
  for (const row of rows) {
    const k = keyFn(row);
    const existing = map.get(k);
    if (!existing || sortTsFn(row) > sortTsFn(existing)) {
      map.set(k, row);
    }
  }
  return map;
}
