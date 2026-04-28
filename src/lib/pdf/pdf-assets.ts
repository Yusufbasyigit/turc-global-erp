// Path to the brand mark embedded in generated PDFs. In the browser the
// public/logo.png file is served at /logo.png by Next.js, so the default
// works for production and dev. Node-side test harnesses set
// PDF_LOGO_OVERRIDE to an absolute file path.
export const PDF_BRAND_LOGO_SRC: string =
  (typeof process !== "undefined" && process.env?.PDF_LOGO_OVERRIDE) ||
  "/logo.png";
