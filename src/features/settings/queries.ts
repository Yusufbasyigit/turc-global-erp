import { createClient } from "@/lib/supabase/client";
import type { AppSettings } from "@/lib/supabase/types";

export const settingsKeys = {
  all: ["settings"] as const,
  app: () => [...settingsKeys.all, "app"] as const,
};

// The app_settings table is a singleton (id = true PK with check constraint),
// so we always read the one row.
export async function getAppSettings(): Promise<AppSettings> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("app_settings")
    .select("*")
    .single();
  if (error) throw error;
  return data as unknown as AppSettings;
}

// Re-export so settings code doesn't reach into treasury for the picker. The
// underlying query is the canonical implementation.
export { listCustodyLocations, treasuryKeys } from "@/features/treasury/queries";
