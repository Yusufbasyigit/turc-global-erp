/**
 * Render every PDF the app produces with realistic sample data so we can
 * eyeball the formatting. Outputs to /tmp/sample-pdfs/.
 *
 * Run with: npx tsx scripts/render-sample-pdfs.tsx
 */
import * as fs from "node:fs";
import * as path from "node:path";

// Override the brand logo path so the PDF generator reads the bundled
// public/logo.png instead of the browser-only /logo.png URL. Must run
// before importing the PDF documents.
process.env.PDF_LOGO_OVERRIDE = path.resolve("public/logo.png");

const { pdf } = await import("@react-pdf/renderer");
const { ProformaDocument } = await import("@/lib/pdf/proforma-pdf");
const { ShipmentStatementDocument } = await import(
  "@/lib/pdf/shipment-statement-pdf"
);
type ProformaData = import("@/lib/pdf/proforma-pdf-types").ProformaData;
type StatementData =
  import("@/lib/pdf/shipment-statement-pdf-types").StatementData;
type DocumentReactElement = Parameters<typeof pdf>[0];

const OUT_DIR = "/tmp/sample-pdfs";
fs.mkdirSync(OUT_DIR, { recursive: true });

const proformaLong: ProformaData = {
  offerNumber: "TG-2026-0042",
  offerDate: "2026-04-28",
  offerValidUntil: "2026-05-28",
  currency: "EUR",
  incoterm: "FOB Istanbul",
  deliveryTimeline: "30 jours après réception du paiement",
  paymentTerms: "30% à la commande, 70% avant expédition",
  customer: {
    companyName: "Sociedad Comercial Mediterráneo S.L.",
    contactPerson: "María González",
    address: "Calle de la Reina 142, 3° izquierda",
    city: "Valencia",
    countryName: "Spain",
  },
  lines: [
    {
      lineNumber: 1,
      productName: "Profilé aluminium 6063-T5 — extrusion sur mesure",
      description:
        "Aluminium anodisé naturel, longueur standard 6 m, tolérance ±2 mm. Conditionné par fagots de 50 unités, film protecteur appliqué.",
      unit: "m",
      quantity: 4500,
      unitPrice: 6.85,
      photoUrl: null,
    },
    {
      lineNumber: 2,
      productName: "Joint d'étanchéité EPDM noir",
      description:
        "Densité 65 Sh A, résistance UV, livraison en rouleaux de 100 m.",
      unit: "m",
      quantity: 1200,
      unitPrice: 1.42,
      photoUrl: null,
    },
    {
      lineNumber: 3,
      productName: "Vis tête fraisée Inox A2 M6×50",
      description:
        "DIN 7991, tête six pans creux, livrée en boîte de 200 unités.",
      unit: "pcs",
      quantity: 8000,
      unitPrice: 0.28,
      photoUrl: null,
    },
    {
      lineNumber: 4,
      productName: "Cornière équerre 40×40×3",
      description: null,
      unit: "pcs",
      quantity: 350,
      unitPrice: 4.5,
      photoUrl: null,
    },
    {
      lineNumber: 5,
      productName: "Plaque polycarbonate alvéolaire 16 mm",
      description:
        "Transparente, traitée anti-UV double face, dimensions 2100×6000 mm, garantie 10 ans.",
      unit: "m²",
      quantity: 252,
      unitPrice: 32.4,
      photoUrl: null,
    },
  ],
  notes: {
    remark:
      "Les marchandises voyagent aux risques et périls de l'acheteur dès leur sortie de notre entrepôt. Toute réclamation doit nous parvenir dans les 8 jours suivant la livraison.",
    validity:
      "Cette offre est valable 30 jours à compter de sa date d'émission.",
    deliveryLocation: "Port d'Ambarli, Istanbul, Turquie",
    productionTime: "30 jours ouvrés après réception de l'acompte",
    lengthTolerance:
      "± 2 mm sur les profilés extrudés, ± 1 mm sur les pièces usinées",
    totalWeight: "Environ 12 800 kg net, 13 200 kg brut",
  },
};

const proformaShort: ProformaData = {
  ...proformaLong,
  offerNumber: "TG-2026-0099",
  lines: [
    {
      lineNumber: 1,
      productName: "Profilé aluminium 6063-T5",
      description: "Anodisé naturel, longueur 6 m.",
      unit: "m",
      quantity: 1500,
      unitPrice: 6.85,
      photoUrl: null,
    },
    {
      lineNumber: 2,
      productName: "Joint EPDM noir",
      description: null,
      unit: "m",
      quantity: 600,
      unitPrice: 1.42,
      photoUrl: null,
    },
  ],
  notes: {
    remark: null,
    validity:
      "Cette offre est valable 30 jours à compter de sa date d'émission.",
    deliveryLocation: null,
    productionTime: null,
    lengthTolerance: null,
    totalWeight: null,
  },
};

const proformaXLong: ProformaData = {
  ...proformaLong,
  offerNumber: "TG-2026-0100",
  lines: Array.from({ length: 18 }, (_, i) => ({
    lineNumber: i + 1,
    productName: `Article catalogue n° ${String(i + 1).padStart(3, "0")} — référence T-${1000 + i}`,
    description:
      i % 3 === 0
        ? "Conditionnement standard usine, livraison franco bord."
        : null,
    unit: ["m", "kg", "pcs", "m²"][i % 4],
    quantity: 100 + i * 25,
    unitPrice: 5 + (i % 7) * 1.45,
    photoUrl: null,
  })),
};

const goodsSubLong =
  4500 * 6.85 + 1200 * 1.42 + 252 * 32.4;

const statementLong: StatementData = {
  shipment: {
    name: "TG-SHIP-2026-018",
    trackingNumber: "MAEU-7821946-3",
    containerType: "1 × 40' HC",
    etdDate: "2026-04-12",
    etaDate: "2026-04-29",
    invoiceCurrency: "EUR",
    freightCost: 2850,
  },
  customer: {
    companyName: "Sociedad Comercial Mediterráneo S.L.",
    contactPerson: "María González",
    address: "Calle de la Reina 142, 3° izquierda",
    city: "Valencia",
    countryName: "Spain",
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

const statementShortNoPayments: StatementData = {
  ...statementLong,
  shipment: { ...statementLong.shipment, name: "TG-SHIP-2026-020" },
  lines: statementLong.lines.slice(0, 2),
  goodsSubtotal: 4500 * 6.85 + 1200 * 1.42,
  grandTotal: 4500 * 6.85 + 1200 * 1.42 + 2850,
  payments: [],
  totalReceived: 0,
  balance: 4500 * 6.85 + 1200 * 1.42 + 2850,
};

const statementCreditFootnote: StatementData = {
  ...statementLong,
  shipment: { ...statementLong.shipment, name: "TG-SHIP-2026-021" },
  totalReceived: goodsSubLong + 2850 + 1500,
  balance: -1500,
  hasSkippedCurrencyEvents: true,
};

async function render(name: string, doc: DocumentReactElement) {
  const outPath = path.join(OUT_DIR, `${name}.pdf`);
  const blob = await pdf(doc).toBlob();
  const buf = Buffer.from(await blob.arrayBuffer());
  fs.writeFileSync(outPath, buf);
  console.log(`Wrote ${outPath} (${(buf.length / 1024).toFixed(1)} KB)`);
}

async function main() {
  await render("proforma-long", <ProformaDocument data={proformaLong} />);
  await render("proforma-short", <ProformaDocument data={proformaShort} />);
  await render("proforma-xlong", <ProformaDocument data={proformaXLong} />);
  await render(
    "statement-long",
    <ShipmentStatementDocument data={statementLong} />,
  );
  await render(
    "statement-no-payments",
    <ShipmentStatementDocument data={statementShortNoPayments} />,
  );
  await render(
    "statement-credit",
    <ShipmentStatementDocument data={statementCreditFootnote} />,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
