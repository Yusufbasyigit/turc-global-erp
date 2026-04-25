// Parse a date-only string (YYYY-MM-DD) as a *local* date, not UTC midnight.
// `new Date("2026-04-25")` is interpreted as UTC, which displays as the
// previous day in any timezone west of UTC. Using the Date(y, m, d) ctor
// keeps the value anchored to the user's local day.
const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseDateLocal(value: string): Date | null {
  const m = DATE_ONLY_RE.exec(value);
  if (!m) {
    const fallback = new Date(value);
    return Number.isFinite(fallback.getTime()) ? fallback : null;
  }
  const year = Number(m[1]);
  const month = Number(m[2]) - 1;
  const day = Number(m[3]);
  const d = new Date(year, month, day);
  return Number.isFinite(d.getTime()) ? d : null;
}

const DEFAULT_OPTS: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "short",
  day: "2-digit",
};

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function getFormatter(opts: Intl.DateTimeFormatOptions): Intl.DateTimeFormat | null {
  // Cache by stringified options. Saves ~all of the Intl.DateTimeFormat
  // construction cost across hundreds of ledger rows on a single render.
  const key = JSON.stringify(opts);
  const cached = formatterCache.get(key);
  if (cached) return cached;
  try {
    const fmt = new Intl.DateTimeFormat(undefined, opts);
    formatterCache.set(key, fmt);
    return fmt;
  } catch {
    return null;
  }
}

export function formatDateOnly(
  value: string | null | undefined,
  opts: Intl.DateTimeFormatOptions = DEFAULT_OPTS,
): string {
  if (!value) return "—";
  const d = parseDateLocal(value);
  if (!d) return value;
  const fmt = getFormatter(opts);
  if (!fmt) return value;
  return fmt.format(d);
}
