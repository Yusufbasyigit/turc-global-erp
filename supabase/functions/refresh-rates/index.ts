// Scheduled (weekday 06:00 UTC via pg_cron) + manual (button) refresh of
// FX + price snapshots. Uses `Promise.allSettled` so one dead upstream
// doesn't block the other. Never throws — returns a 200 with the outcome
// JSON so the caller (pg_net / invoke) can log it without retry loops.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.104.0";

import {
  logRefreshRun,
  refreshFxSnapshots,
  refreshPriceSnapshots,
  refreshTickerRegistry,
} from "./refresh-engine.ts";

Deno.serve(async () => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(
      JSON.stringify({ error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  // Refresh the ticker registry first so refreshPriceSnapshots can resolve
  // any newly-added coin's slug via the registry on the very same run.
  // Outcomes for fx/price still go to rate_refresh_runs; the registry result
  // is logged to console (the table's schema doesn't carry a third slot,
  // and a fresh migration just for an internal seed status would be churn).
  const registry = await refreshTickerRegistry(client).catch((e: unknown) => ({
    inserted: 0,
    skipped: [],
    errors: [String((e as Error)?.message ?? e)],
  }));
  if (registry.errors.length > 0) {
    console.error("ticker_registry refresh errors:", registry.errors);
  } else {
    console.log(`ticker_registry: upserted ${registry.inserted} rows`);
  }

  const [fx, price] = await Promise.allSettled([
    refreshFxSnapshots(client),
    refreshPriceSnapshots(client),
  ]);

  try {
    await logRefreshRun(client, "cron", fx, price);
  } catch (logErr) {
    console.error("rate_refresh_runs insert failed:", logErr);
  }

  return new Response(
    JSON.stringify({
      registry,
      fx: fx.status === "fulfilled" ? fx.value : { error: String((fx.reason as Error)?.message ?? fx.reason) },
      price:
        price.status === "fulfilled"
          ? price.value
          : { error: String((price.reason as Error)?.message ?? price.reason) },
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
});
