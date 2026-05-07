import { StyleSheet } from "@react-pdf/renderer";
import {
  BUILTIN_FONT_FAMILY,
  PDF_FONT_FAMILY,
  pdfFontsAvailable,
} from "./font-registration";

// Editorial Defter palette — warm-paper aesthetic, hex equivalents of the
// app's OKLCH tokens in src/app/globals.css. Restrained ink + brick accent;
// brand red kept available for the brand mark only.
export const PAPER = "#FAF7F0";
export const PANEL = "#F4EFE6";
export const ZEBRA = "#F2EDE2";
export const INK = "#2C2926";
export const MUTED = "#6B6963";
export const DIM = "#8E8B83";
export const HAIRLINE = "#D8D2C5";
export const RULE = "#2C2926";
export const BRICK = "#A4452C";
export const BRAND_RED = "#D71920";
export const POSITIVE = "#4A8B3F";

// Legacy aliases kept so existing imports keep compiling — point at the new
// editorial tokens. ACCENT_RED now reads as brick (warm) rather than the old
// muddy maroon.
export const ACCENT_RED = BRICK;
export const BORDER = HAIRLINE;
export const CREDIT_GREEN = POSITIVE;

// Document fonts. When `public/fonts/*` is populated (see
// font-registration.ts) we use Inter / Instrument Serif / JetBrains Mono —
// all OFL-licensed and shipping with full Latin Extended-A coverage so
// Turkish names render correctly. When the files aren't present we fall
// back to Helvetica / Times / Courier (built-in WinAnsi) plus the
// transliteration in text-encoding.ts. This means the build is always
// green and the PDFs are always readable.
const FAMILY = pdfFontsAvailable ? PDF_FONT_FAMILY : BUILTIN_FONT_FAMILY;
const SANS = FAMILY.SANS;
const SANS_BOLD = FAMILY.SANS_BOLD;
const SANS_OBLIQUE = FAMILY.SANS_OBLIQUE;
const SERIF = FAMILY.SERIF;
const SERIF_ITALIC = FAMILY.SERIF_ITALIC;
const MONO = FAMILY.MONO;
const MONO_BOLD = FAMILY.MONO_BOLD;

export const sharedStyles = StyleSheet.create({
  page: {
    paddingTop: 40,
    paddingBottom: 44,
    paddingHorizontal: 44,
    fontFamily: SANS,
    fontSize: 9,
    color: INK,
    backgroundColor: PAPER,
    lineHeight: 1.4,
  },
  row: { flexDirection: "row" },

  // Top banner: full-width centred logo lockup, no surrounding chrome.
  brandBanner: {
    alignItems: "center",
    marginBottom: 8,
  },
  brandLogo: {
    height: 42,
    width: 168,
    objectFit: "contain",
  },
  // Letterhead row sits under the banner — sender info on the left, document
  // meta callout on the right. Both columns share equal flex so the page
  // reads symmetrically.
  letterhead: { flexDirection: "row", gap: 24, marginTop: 6 },
  letterheadCol: { flex: 1 },
  letterheadColRight: { flex: 1, alignItems: "flex-end" },
  companyName: {
    fontFamily: SANS_BOLD,
    fontSize: 10,
    color: INK,
    letterSpacing: 0.4,
    marginBottom: 3,
  },
  muted: { color: MUTED, fontSize: 8.5, lineHeight: 1.55 },
  mutedRight: { color: MUTED, fontSize: 8.5, lineHeight: 1.55, textAlign: "right" },
  dim: { color: DIM, fontSize: 8 },

  // Legacy header alias — old call sites still reference these names.
  header: { flexDirection: "row", alignItems: "flex-start", gap: 14 },
  headerLogo: { width: 44, height: 44, objectFit: "contain" },

  // Document title — serif display, used between thin double-rules
  titleBlock: {
    marginTop: 14,
    marginBottom: 12,
    borderTopWidth: 0.6,
    borderBottomWidth: 0.6,
    borderColor: RULE,
    paddingTop: 10,
    paddingBottom: 10,
    alignItems: "center",
  },
  title: {
    fontFamily: SERIF,
    fontSize: 28,
    color: INK,
    letterSpacing: 1.2,
    lineHeight: 1,
  },
  titleAccent: {
    fontFamily: SERIF_ITALIC,
    color: BRICK,
  },
  titleSub: {
    fontFamily: SANS_BOLD,
    fontSize: 8,
    color: MUTED,
    letterSpacing: 2,
    marginTop: 10,
    lineHeight: 1,
  },

  // Editorial primitives
  kicker: {
    fontFamily: SANS_BOLD,
    fontSize: 8,
    color: MUTED,
    letterSpacing: 1.2,
  },
  sectionGap: { marginTop: 18 },
  sectionHead: {
    paddingBottom: 5,
    marginBottom: 10,
    borderBottomWidth: 0.6,
    borderColor: RULE,
  },
  sectionHeadText: {
    fontFamily: SANS_BOLD,
    fontSize: 8.5,
    color: INK,
    letterSpacing: 1.4,
  },

  // Two-column blocks (no red bar; kicker + hairline instead)
  twoCol: { flexDirection: "row", gap: 18 },
  col: { flex: 1 },
  twoColDivider: {
    width: 0.4,
    backgroundColor: HAIRLINE,
    alignSelf: "stretch",
  },

  // Key-value rows
  kv: { flexDirection: "row", marginBottom: 5, alignItems: "flex-start" },
  kvKey: {
    width: 68,
    fontFamily: SANS_BOLD,
    color: MUTED,
    fontSize: 8,
    letterSpacing: 1.2,
    paddingTop: 2.5,
  },
  kvVal: { flex: 1, fontSize: 10, color: INK, lineHeight: 1.35 },
  kvValStrong: {
    flex: 1,
    fontFamily: SANS_BOLD,
    fontSize: 10,
    color: INK,
    lineHeight: 1.35,
  },
  kvValMono: {
    flex: 1,
    fontFamily: MONO,
    fontSize: 9.5,
    color: INK,
    lineHeight: 1.35,
  },

  // Tables — kicker headers, hairline rows, no solid color band
  tHead: {
    flexDirection: "row",
    borderTopWidth: 0.8,
    borderBottomWidth: 0.6,
    borderColor: RULE,
    paddingVertical: 7,
  },
  tHeadCell: {
    paddingHorizontal: 4,
    fontFamily: SANS_BOLD,
    fontSize: 8,
    color: MUTED,
    letterSpacing: 1.2,
  },
  tRow: {
    flexDirection: "row",
    borderBottomWidth: 0.4,
    borderColor: HAIRLINE,
    minHeight: 30,
    alignItems: "center",
  },
  tRowZebra: { backgroundColor: PANEL },
  td: {
    paddingHorizontal: 4,
    paddingVertical: 6,
    fontSize: 9,
  },
  tdMono: {
    paddingHorizontal: 4,
    paddingVertical: 6,
    fontSize: 9,
    fontFamily: MONO,
  },
  tdSerifItalic: {
    paddingHorizontal: 4,
    paddingVertical: 6,
    fontSize: 9.5,
    fontFamily: SERIF_ITALIC,
    color: MUTED,
  },

  // Legacy stub names still imported by older callers.
  bar: { display: "none" },
  blockBody: { paddingTop: 4 },
  th: {
    paddingHorizontal: 4,
    fontFamily: SANS_BOLD,
    fontSize: 8,
    color: MUTED,
    letterSpacing: 1.2,
  },

  // Customer / counterparty display name in client blocks
  partyName: {
    fontFamily: SANS_BOLD,
    fontSize: 12,
    color: INK,
    letterSpacing: 0.2,
    marginBottom: 6,
  },

  // Re-exported for component use
  serif: { fontFamily: SERIF },
  serifItalic: { fontFamily: SERIF_ITALIC },
  sans: { fontFamily: SANS },
  sansBold: { fontFamily: SANS_BOLD },
  sansOblique: { fontFamily: SANS_OBLIQUE },
  mono: { fontFamily: MONO },
  monoBold: { fontFamily: MONO_BOLD },
});

export const PDF_FONTS = {
  SANS,
  SANS_BOLD,
  SANS_OBLIQUE,
  SERIF,
  SERIF_ITALIC,
  MONO,
  MONO_BOLD,
};
