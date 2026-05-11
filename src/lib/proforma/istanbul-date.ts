import { istanbulToday } from "@/lib/format-date";

const ISTANBUL_MONTH_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Istanbul",
  year: "numeric",
  month: "2-digit",
});

export function istanbulYYYYMMDD(date: Date = new Date()): string {
  return istanbulToday(date).replace(/-/g, "");
}

export function formatOfferDateShort(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  if (!y || !m || !d) return "—";
  return `${d}.${m}.${y}`;
}

// Thin alias kept for the proforma module's existing imports. Prefer
// `istanbulToday` from `@/lib/format-date` in new code — both return the
// same string; this just routes through the single canonical helper so
// the Istanbul-TZ contract lives in one place.
export function todayIsoDate(): string {
  return istanbulToday();
}

export function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return istanbulToday(d);
}

export function istanbulYearMonth(date: Date | string): string {
  const d =
    typeof date === "string" ? new Date(`${date.slice(0, 10)}T12:00:00Z`) : date;
  const [y, m] = ISTANBUL_MONTH_FORMATTER.format(d).split("-");
  return `${y}-${m}`;
}

export function shiftYearMonth(period: string, deltaMonths: number): string {
  const [y, m] = period.split("-").map(Number);
  const total = y * 12 + (m - 1) + deltaMonths;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${ny.toString().padStart(4, "0")}-${nm.toString().padStart(2, "0")}`;
}
