// Editorial Ledger formatters.
// Spec §4: ₺ prefix, no space, thousands `,`, decimal `.`, `−` (minus, not
// hyphen) for negatives. Em-dash `—` for empty values.

const TRY_INT = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
});

const TRY_2DP = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatTryShort(value: number): string {
  const sign = value < 0 ? "−" : "";
  const abs = Math.abs(value);
  return `${sign}₺${TRY_INT.format(Math.round(abs))}`;
}

export function formatTryFull(value: number): string {
  const sign = value < 0 ? "−" : "";
  const abs = Math.abs(value);
  return `${sign}₺${TRY_2DP.format(abs)}`;
}

// Compact rendering for the trend-chart legend: ₺2.94M, ₺412K, etc.
export function formatTryCompact(value: number): string {
  const sign = value < 0 ? "−" : "";
  const abs = Math.abs(value);
  if (abs >= 1_000_000) {
    return `${sign}₺${(abs / 1_000_000).toFixed(2)}M`;
  }
  if (abs >= 1_000) {
    return `${sign}₺${(abs / 1_000).toFixed(0)}K`;
  }
  return `${sign}₺${TRY_INT.format(Math.round(abs))}`;
}

// "Saturday, 25 April 2026" — masthead long date.
export function formatLongDate(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

// "24 Apr" — short table date.
export function formatShortDate(iso: string): string {
  // Parse as a *local* date to avoid timezone drift. Using `new Date(iso)`
  // or a UTC-anchored midnight/noon flips the day in extreme timezones.
  const slice = iso.slice(0, 10);
  const [yStr, mStr, dStr] = slice.split("-");
  const year = Number(yStr);
  const month = Number(mStr);
  const day = Number(dStr);
  if (!year || !month || !day) return iso;
  const d = new Date(year, month - 1, day);
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
  }).format(d);
}

// "25.04.2026 · 09:14" — footer ISO-with-dots stamp.
export function formatFooterTimestamp(d: Date = new Date()): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${dd}.${mm}.${yyyy} · ${hh}:${min}`;
}

const MONTH_NAMES_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function monthLongFromPeriod(period: string): string {
  const m = Number(period.slice(5, 7));
  return MONTH_NAMES_LONG[m - 1] ?? period;
}

export function periodFirstLetter(period: string): string {
  const m = Number(period.slice(5, 7));
  return ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"][m - 1] ?? "";
}

// "FY 2026 · Q2"
export function fyQuarterLabel(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = d.getMonth(); // 0-indexed
  const q = Math.floor(month / 3) + 1;
  return `FY ${year} · Q${q}`;
}

// "Period: Apr 01 — Apr 25"
export function periodRangeLabel(d: Date = new Date()): string {
  const monthName = new Intl.DateTimeFormat("en-GB", { month: "short" }).format(d);
  const day = d.getDate();
  return `Period: ${monthName} 01 — ${monthName} ${String(day).padStart(2, "0")}`;
}
