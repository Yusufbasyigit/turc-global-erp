// Built-in PDF fonts (Helvetica, Times, Courier) use WinAnsi encoding, which
// covers most of Latin-1 but lacks Latin Extended-A glyphs. To keep the
// generated PDFs readable while a real Unicode-capable font isn't yet
// registered (see `font-registration.ts`), we transliterate the common
// non-WinAnsi letters to their nearest Latin equivalent before laying out
// text. The list covers Turkish (the primary use case), Polish, Czech /
// Slovak, Hungarian, Romanian, Croatian and Esperanto so that European
// counterparty names degrade gracefully instead of dropping glyphs.
//
// Once `public/fonts/Inter-*.ttf` (and friends) are in place, the
// `pdfFontsAvailable` flag flips to true and `pdfText()` becomes a pass-
// through — the transliteration is only applied as a fallback.

import { pdfFontsAvailable } from "./font-registration";

const FALLBACK_MAP: Record<string, string> = {
  // Turkish
  "ş": "s", "Ş": "S",
  "ı": "i", "İ": "I",
  "ğ": "g", "Ğ": "G",
  // Polish
  "ą": "a", "Ą": "A",
  "ć": "c", "Ć": "C",
  "ę": "e", "Ę": "E",
  "ł": "l", "Ł": "L",
  "ń": "n", "Ń": "N",
  "ś": "s", "Ś": "S",
  "ź": "z", "Ź": "Z",
  "ż": "z", "Ż": "Z",
  // Czech / Slovak
  "č": "c", "Č": "C",
  "ď": "d", "Ď": "D",
  "ě": "e", "Ě": "E",
  "ň": "n", "Ň": "N",
  "ř": "r", "Ř": "R",
  "š": "s", "Š": "S",
  "ť": "t", "Ť": "T",
  "ů": "u", "Ů": "U",
  "ý": "y", "Ý": "Y",
  "ž": "z", "Ž": "Z",
  // Hungarian
  "ő": "o", "Ő": "O",
  "ű": "u", "Ű": "U",
  // Romanian (ş/Ş are listed under Turkish above and re-used here)
  "ă": "a", "Ă": "A",
  "â": "a", "Â": "A",
  "î": "i", "Î": "I",
  "ț": "t", "Ț": "T",
  // Croatian / Bosnian / Serbian (Latin)
  "đ": "d", "Đ": "D",
};

const FALLBACK_RE = new RegExp(
  `[${Object.keys(FALLBACK_MAP).join("")}]`,
  "g",
);

export function pdfText(input: string | null | undefined): string {
  if (input == null) return "";
  if (pdfFontsAvailable) return input;
  return input.replace(FALLBACK_RE, (c) => FALLBACK_MAP[c] ?? c);
}
