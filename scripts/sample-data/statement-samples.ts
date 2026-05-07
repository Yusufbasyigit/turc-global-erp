import type { StatementData } from "@/lib/pdf/shipment-statement-pdf-types";
import { SAMPLE_COMPANY } from "./company";

const goodsSubLong = 4500 * 6.85 + 1200 * 1.42 + 252 * 32.4;

export const sampleStatementLong: StatementData = {
  shipment: {
    name: "TG-SHIP-2026-018",
    trackingNumber: "MAEU-7821946-3",
    containerType: "1 × 40' HC",
    etdDate: "2026-04-12",
    etaDate: "2026-04-29",
    invoiceCurrency: "EUR",
    freightCost: 2850,
  },
  company: SAMPLE_COMPANY,
  customer: {
    companyName: "Sociedad Comercial Mediterráneo S.L.",
    contactPerson: "María González",
    address: "Calle de la Reina 142, 3° izquierda",
    city: "Valencia",
    countryName: "Spain",
    taxId: "ESB-87654321",
  },
  lines: [
    {
      lineNumber: 1,
      productName: "Profilé aluminium 6063-T5 — extrusion sur mesure",
      quantity: 4500,
      unit: "m",
      unitPrice: 6.85,
      lineTotal: 4500 * 6.85,
      status: "new",
    },
    {
      lineNumber: 2,
      productName: "Joint d'étanchéité EPDM noir",
      quantity: 1200,
      unit: "m",
      unitPrice: 1.42,
      lineTotal: 1200 * 1.42,
      status: "new",
    },
    {
      lineNumber: 3,
      productName: "Vis tête fraisée Inox A2 M6×50",
      quantity: 8000,
      unit: "pcs",
      unitPrice: 0.28,
      lineTotal: 8000 * 0.28,
      status: "rolled_over",
      rolledOverToName: "TG-SHIP-2026-019",
    },
    {
      lineNumber: 4,
      productName: "Cornière équerre 40×40×3",
      quantity: 350,
      unit: "pcs",
      unitPrice: 4.5,
      lineTotal: 350 * 4.5,
      status: "cancelled",
    },
    {
      lineNumber: 5,
      productName: "Plaque polycarbonate alvéolaire 16 mm",
      quantity: 252,
      unit: "m²",
      unitPrice: 32.4,
      lineTotal: 252 * 32.4,
      status: "new",
    },
  ],
  goodsSubtotal: goodsSubLong,
  grandTotal: goodsSubLong + 2850,
  payments: [
    {
      date: "2026-03-15",
      description: "Virement bancaire — acompte 30%",
      allocatedAmount: 12_000,
      partialAnnotation: null,
    },
    {
      date: "2026-04-08",
      description: "Virement bancaire — solde avant expédition",
      allocatedAmount: 25_000,
      partialAnnotation:
        "Allocation partielle — 4 200 EUR retenus pour TG-SHIP-2026-019",
    },
  ],
  totalReceived: 37_000,
  balance: goodsSubLong + 2850 - 37_000,
  isBillingStale: false,
  hasSkippedCurrencyEvents: false,
};

export const sampleStatementNoPayments: StatementData = {
  ...sampleStatementLong,
  shipment: { ...sampleStatementLong.shipment, name: "TG-SHIP-2026-020" },
  lines: sampleStatementLong.lines.slice(0, 2),
  goodsSubtotal: 4500 * 6.85 + 1200 * 1.42,
  grandTotal: 4500 * 6.85 + 1200 * 1.42 + 2850,
  payments: [],
  totalReceived: 0,
  balance: 4500 * 6.85 + 1200 * 1.42 + 2850,
};

export const sampleStatementCredit: StatementData = {
  ...sampleStatementLong,
  shipment: { ...sampleStatementLong.shipment, name: "TG-SHIP-2026-021" },
  totalReceived: goodsSubLong + 2850 + 1500,
  balance: -1500,
  hasSkippedCurrencyEvents: true,
};

export const sampleStatementTurkish: StatementData = {
  ...sampleStatementLong,
  shipment: {
    ...sampleStatementLong.shipment,
    name: "TG-SHIP-2026-022",
    trackingNumber: "TÜRK-2026-İST-005",
    containerType: "2 × 20' DC",
  },
  customer: {
    companyName: "İğneada Şirketi Ticaret A.Ş.",
    contactPerson: "Ayşe Şıkşıkoğlu",
    address: "Atatürk Bulvarı No: 142, Şişli",
    city: "İstanbul",
    countryName: "Türkiye",
    taxId: "VKN: 1234567890",
  },
  lines: [
    {
      lineNumber: 1,
      productName: "Sıcak haddelenmiş çelik profil",
      quantity: 12500,
      unit: "kg",
      unitPrice: 1.85,
      lineTotal: 12500 * 1.85,
      status: "new",
    },
    {
      lineNumber: 2,
      productName: "Galvanizli bağlantı elemanı (DİN 7991, M8)",
      quantity: 4000,
      unit: "pcs",
      unitPrice: 0.42,
      lineTotal: 4000 * 0.42,
      status: "new",
    },
  ],
  goodsSubtotal: 12500 * 1.85 + 4000 * 0.42,
  grandTotal: 12500 * 1.85 + 4000 * 0.42 + 2850,
  payments: [
    {
      date: "2026-04-02",
      description: "Banka havalesi — peşinat",
      allocatedAmount: 6000,
      partialAnnotation: null,
    },
  ],
  totalReceived: 6000,
  balance: 12500 * 1.85 + 4000 * 0.42 + 2850 - 6000,
};
