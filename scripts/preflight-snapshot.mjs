// Snapshot row counts per table in public schema and write to a JSON file.
// Usage: node scripts/preflight-snapshot.mjs [outPath]
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

// Hand-load .env.local
const envPath = path.join(__dirname, "..", ".env.local");
const envText = fs.readFileSync(envPath, "utf8");
for (const line of envText.split(/\r?\n/)) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m) process.env[m[1]] = m[2];
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

const TABLES = [
  "accounts",
  "contact_notes",
  "contacts",
  "countries",
  "custody_locations",
  "expense_types",
  "fx_snapshots",
  "monthly_fx_overrides",
  "order_details",
  "orders",
  "partners",
  "price_snapshots",
  "product_categories",
  "products",
  "rate_refresh_runs",
  "shipments",
  "transactions",
  "treasury_movements",
];

const out = {};
for (const t of TABLES) {
  const { count, error } = await supabase
    .from(t)
    .select("*", { count: "exact", head: true });
  if (error) {
    out[t] = { error: error.message };
    console.error(`! ${t}: ${error.message}`);
  } else {
    out[t] = count;
    console.log(`  ${t}: ${count}`);
  }
}

const outPath = process.argv[2] ?? "/tmp/preflight-counts.json";
fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
console.log(`\nWrote ${outPath}`);
