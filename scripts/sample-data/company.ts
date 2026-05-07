import type { ProformaCompany } from "@/lib/pdf/proforma-pdf-types";

// Realistic Turkish company name and address that exercises the full
// Turkish glyph repertoire (ç, ğ, ı, İ, ö, ş, ü) — this is the surface that
// silently broke under the WinAnsi-only built-in fonts.
export const SAMPLE_COMPANY: ProformaCompany = {
  name: "Turc Global Danışmanlık ve Dış Ticaret LTD. ŞTİ.",
  addressLine1: "Çobançeşme Mah., Sanayi Cad. Vadi Sk. No:5",
  addressLine2: "34196 Bahçelievler · İstanbul · Türkiye",
  phone: "+90 530 927 57 89",
  email: "info@turcglobal.com",
  taxId: "8730549271",
  taxOffice: "Bahçelievler",
};
