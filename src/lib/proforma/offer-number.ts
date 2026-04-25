import type { SupabaseClient } from "@supabase/supabase-js";
import { istanbulYYYYMMDD } from "./istanbul-date";

// TODO(Wave 3d+): allow manual override of offer_number via admin affordance.
export async function generateOfferNumber(
  supabase: SupabaseClient,
  offerDateIso: string,
): Promise<string> {
  const date = new Date(`${offerDateIso}T12:00:00Z`);
  const yyyymmdd = istanbulYYYYMMDD(date);
  const prefix = `TG-${yyyymmdd}-`;

  // Use MAX(suffix)+1 so deleted offers don't collapse the sequence and
  // produce a duplicate offer_number. (Counting rows would yield N+1, which
  // collides if any earlier number was deleted.)
  const { data, error } = await supabase
    .from("orders")
    .select("offer_number")
    .like("offer_number", `${prefix}%`);
  if (error) throw error;

  let max = 0;
  for (const row of data ?? []) {
    const offerNumber = (row as { offer_number: string | null }).offer_number;
    if (!offerNumber) continue;
    const suffix = offerNumber.slice(prefix.length);
    const n = Number.parseInt(suffix, 10);
    if (Number.isFinite(n) && n > max) max = n;
  }

  const next = max + 1;
  return `${prefix}${String(next).padStart(3, "0")}`;
}
