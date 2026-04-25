// Scheduled (weekday 06:00 UTC via pg_cron) + manual (button) refresh of
// FX + price snapshots. Uses `Promise.allSettled` so one dead upstream
// doesn't block the other. Never throws — returns a 200 with the outcome
// JSON so the caller (pg_net / invoke) can log it without retry loops.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.104.0";

import {
  logRefreshRun,
  refreshFxSnapshots,
  refreshPriceSnapshots,
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
      fx: fx.status === "fulfilled" ? fx.value : { error: String((fx.reason as Error)?.message ?? fx.reason) },
      price:
        price.status === "fulfilled"
          ? price.value
          : { error: String((price.reason as Error)?.message ?? price.reason) },
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
});
