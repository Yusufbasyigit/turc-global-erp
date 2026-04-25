// Cached Intl.NumberFormat instances. Constructing a NumberFormat is
// surprisingly expensive (locale data lookup), so building one per cell
// across hundreds of ledger rows is a measurable hit on render.

const currencyFormatters = new Map<string, Intl.NumberFormat>();
let plainFormatter: Intl.NumberFormat | null = null;

function getCurrencyFormatter(currency: string): Intl.NumberFormat | null {
  const cached = currencyFormatters.get(currency);
  if (cached) return cached;
  try {
    const fmt = new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    });
    currencyFormatters.set(currency, fmt);
    return fmt;
  } catch {
    return null;
  }
}

function getPlainFormatter(): Intl.NumberFormat {
  if (plainFormatter) return plainFormatter;
  plainFormatter = new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return plainFormatter;
}

export function formatCurrency(value: number, currency: string): string {
  const fmt = getCurrencyFormatter(currency);
  if (fmt) return fmt.format(value);
  return `${getPlainFormatter().format(value)} ${currency}`;
}

export function formatMoneyPlain(value: number): string {
  return getPlainFormatter().format(value);
}
