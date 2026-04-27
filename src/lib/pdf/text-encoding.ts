// Built-in PDF fonts (Helvetica, Times, Courier) use WinAnsi encoding, which
// covers most of Latin-1 but lacks the Turkish-specific Latin Extended-A
// glyphs (ş, ı, İ, Ş, ğ, Ğ). To keep the proforma readable on built-in fonts
// we transliterate those six characters to their nearest Latin equivalent
// before laying out text. The remaining Turkish letters (ç, Ç, ö, Ö, ü, Ü)
// already exist in WinAnsi and pass through unchanged.

const TURKISH_FALLBACKS: Record<string, string> = {
  "ş": "s",
  "Ş": "S",
  "ı": "i",
  "İ": "I",
  "ğ": "g",
  "Ğ": "G",
};

const TURKISH_RE = /[şŞıİğĞ]/g;

export function pdfText(input: string | null | undefined): string {
  if (input == null) return "";
  return input.replace(TURKISH_RE, (c) => TURKISH_FALLBACKS[c] ?? c);
}
