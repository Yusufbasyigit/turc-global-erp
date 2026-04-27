// Normalize narrow no-break space (U+202F) and no-break space (U+00A0) to a
// regular space. Intl.NumberFormat("fr-FR") emits NNBSP between thousands and
// before the currency symbol; not all fonts ship that glyph (notably the PDF
// builtins and several display faces), so it renders as a slash or tofu in
// generated PDFs. Folding to a normal space keeps the visual rhythm without
// the rendering risk.
function normalizeSpaces(s: string): string {
  return s.replace(/[  ]/g, " ");
}

export function formatProformaMoney(
  amount: number,
  currency: string,
): string {
  try {
    return normalizeSpaces(
      new Intl.NumberFormat("fr-FR", {
        style: "currency",
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(amount),
    );
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

export function formatProformaQty(qty: number): string {
  return normalizeSpaces(
    new Intl.NumberFormat("fr-FR", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(qty),
  );
}
