// Font registration for generated PDFs.
//
// The default @react-pdf/renderer fonts (Helvetica, Times-Roman, Courier)
// use WinAnsi encoding and cannot render Latin Extended-A glyphs — most
// notably the Turkish ş ı İ ğ Ş Ğ but also Polish, Czech, Romanian,
// Hungarian and Croatian letters. Rather than silently transliterating
// company names ("İğneada Şirketi" → "Igneada Sirketi"), we register a
// Unicode-capable font family when the TTF files are present in
// `public/fonts/`.
//
// To enable proper rendering, drop the following files into `public/fonts/`:
//   - Inter-Regular.ttf
//   - Inter-Bold.ttf
//   - Inter-Italic.ttf
//   - InstrumentSerif-Regular.ttf
//   - InstrumentSerif-Italic.ttf
//   - JetBrainsMono-Regular.ttf
//   - JetBrainsMono-Bold.ttf
// (Inter / Instrument Serif / JetBrains Mono are all OFL-licensed and
// match the on-screen Editorial Defter palette. Any TTF with full Latin
// Extended-A coverage will work — what matters is that those exact
// filenames exist.)
//
// Two execution environments are supported:
//   - Browser: opt-in via `NEXT_PUBLIC_PDF_FONTS_AVAILABLE=true` in
//     `.env.local`. We can't probe `/fonts/*` synchronously from
//     in-page code, and a missing file makes @react-pdf throw mid-PDF-
//     generation ("Failed to fetch font ... 404") rather than fall back.
//     So browser-side registration stays OFF by default — flip the flag
//     the same day you drop the TTFs into `public/fonts/`.
//   - Node (sample renderer & tests): set `PDF_FONTS_DIR` to an absolute
//     filesystem path. We probe each file via `fs.existsSync` and only
//     register if every required file is present.
//
// If neither flag is set the document falls back to the WinAnsi pipeline
// + transliteration in `text-encoding.ts`. The build is always green and
// PDFs are always readable while you decide which font to ship.

import { Font } from "@react-pdf/renderer";

const REQUIRED_FILES = [
  "Inter-Regular.ttf",
  "Inter-Bold.ttf",
  "Inter-Italic.ttf",
  "InstrumentSerif-Regular.ttf",
  "InstrumentSerif-Italic.ttf",
  "JetBrainsMono-Regular.ttf",
  "JetBrainsMono-Bold.ttf",
];

// One registered family per weight/style. Keeping them separate means the
// existing style sheets — which assign font names by string, e.g.
// `fontFamily: "Inter-Bold"` — work without needing to also set
// `fontWeight`. It costs an extra Font.register() call per variant, but
// keeps the styling code uniform between built-in and Unicode modes.
export const PDF_FONT_FAMILY = {
  SANS: "Inter",
  SANS_BOLD: "Inter-Bold",
  SANS_OBLIQUE: "Inter-Italic",
  SERIF: "InstrumentSerif",
  SERIF_ITALIC: "InstrumentSerif-Italic",
  MONO: "JetBrainsMono",
  MONO_BOLD: "JetBrainsMono-Bold",
};

// Built-in PDF font names — used when no Unicode TTFs are registered. These
// match the legacy Helvetica/Times/Courier setup that has shipped to date.
export const BUILTIN_FONT_FAMILY = {
  SANS: "Helvetica",
  SANS_BOLD: "Helvetica-Bold",
  SANS_OBLIQUE: "Helvetica-Oblique",
  SERIF: "Times-Roman",
  SERIF_ITALIC: "Times-Italic",
  MONO: "Courier",
  MONO_BOLD: "Courier-Bold",
};

function resolveFontSrc(filename: string): string | null {
  // Node side: PDF_FONTS_DIR is an absolute filesystem path. Probe it
  // synchronously so we know whether to register or skip.
  if (typeof process !== "undefined" && process.env?.PDF_FONTS_DIR) {
    const dir = process.env.PDF_FONTS_DIR;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const fs = require("node:fs") as typeof import("node:fs");
      const full = `${dir.replace(/\/$/, "")}/${filename}`;
      if (fs.existsSync(full)) return full;
      return null;
    } catch {
      return null;
    }
  }
  // Browser side: opt-in only. We can't sync-probe `/fonts/*` from the
  // renderer, and an optimistic register followed by a 404 makes
  // @react-pdf throw "Failed to fetch font ... 404" mid-PDF-generation
  // rather than fall back to WinAnsi. Set
  // `NEXT_PUBLIC_PDF_FONTS_AVAILABLE=true` in .env.local once the
  // expected TTFs are in `public/fonts/`.
  if (
    typeof window !== "undefined" &&
    process.env.NEXT_PUBLIC_PDF_FONTS_AVAILABLE === "true"
  ) {
    return `/fonts/${filename}`;
  }
  return null;
}

function tryRegisterUnicodeFonts(): boolean {
  // Probe every required file. If any is missing, abort registration —
  // mixing Unicode fonts with built-ins would produce inconsistent output.
  const sources: Record<string, string> = {};
  for (const file of REQUIRED_FILES) {
    const src = resolveFontSrc(file);
    if (!src) return false;
    sources[file] = src;
  }

  Font.register({ family: "Inter", src: sources["Inter-Regular.ttf"] });
  Font.register({ family: "Inter-Bold", src: sources["Inter-Bold.ttf"] });
  Font.register({ family: "Inter-Italic", src: sources["Inter-Italic.ttf"] });
  Font.register({
    family: "InstrumentSerif",
    src: sources["InstrumentSerif-Regular.ttf"],
  });
  Font.register({
    family: "InstrumentSerif-Italic",
    src: sources["InstrumentSerif-Italic.ttf"],
  });
  Font.register({
    family: "JetBrainsMono",
    src: sources["JetBrainsMono-Regular.ttf"],
  });
  Font.register({
    family: "JetBrainsMono-Bold",
    src: sources["JetBrainsMono-Bold.ttf"],
  });

  return true;
}

// Disable hyphenation on every font we register: react-pdf otherwise
// breaks long words mid-glyph (e.g. "han-dle"), which is unacceptable
// in editorial copy.
Font.registerHyphenationCallback((word) => [word]);

export const pdfFontsAvailable: boolean = tryRegisterUnicodeFonts();
