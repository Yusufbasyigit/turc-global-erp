import { createClient } from "@/lib/supabase/client";
import { AUTH_DISABLED } from "@/lib/auth-mode";
import type { MonthlyFxOverrideInsert } from "@/lib/supabase/types";

async function currentUserId(): Promise<string | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    if (AUTH_DISABLED) return null;
    throw new Error("Not authenticated");
  }
  return user.id;
}

export async function upsertMonthlyFxOverride(input: {
  period: string;
  currencyCode: string;
  ratePerUsd: number;
  note?: string | null;
}): Promise<void> {
  if (!Number.isFinite(input.ratePerUsd) || input.ratePerUsd <= 0) {
    throw new Error("Rate must be a positive number.");
  }
  const supabase = createClient();
  const userId = await currentUserId();
  const payload: MonthlyFxOverrideInsert = {
    period: input.period,
    currency_code: input.currencyCode.toUpperCase(),
    rate_to_usd: 1 / input.ratePerUsd,
    note: input.note?.trim() ? input.note.trim() : null,
    set_at: new Date().toISOString(),
    set_by: userId,
  };
  const { error } = await supabase
    .from("monthly_fx_overrides")
    .upsert(payload, { onConflict: "period,currency_code" });
  if (error) throw error;
}

export async function deleteMonthlyFxOverride(
  period: string,
  currencyCode: string,
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("monthly_fx_overrides")
    .delete()
    .eq("period", period)
    .eq("currency_code", currencyCode.toUpperCase());
  if (error) throw error;
}
