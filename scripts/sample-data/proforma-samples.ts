import type { ProformaData } from "@/lib/pdf/proforma-pdf-types";
import { SAMPLE_COMPANY } from "./company";

export const sampleProformaLong: ProformaData = {
  offerNumber: "TG-2026-0042",
  offerDate: "2026-04-28",
  offerValidUntil: "2026-05-28",
  currency: "EUR",
  incoterm: "FOB Istanbul",
  deliveryTimeline: "30 jours après réception du paiement",
  paymentTerms: "30% à la commande, 70% avant expédition",
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
    validity: "Cette offre est valable 30 jours à compter de sa date d'émission.",
    deliveryLocation: "Port d'Ambarli, Istanbul, Turquie",
    productionTime: "30 jours ouvrés après réception de l'acompte",
    lengthTolerance:
      "± 2 mm sur les profilés extrudés, ± 1 mm sur les pièces usinées",
    totalWeight: "Environ 12 800 kg net, 13 200 kg brut",
  },
};

export const sampleProformaShort: ProformaData = {
  ...sampleProformaLong,
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
    validity: "Cette offre est valable 30 jours à compter de sa date d'émission.",
    deliveryLocation: null,
    productionTime: null,
    lengthTolerance: null,
    totalWeight: null,
  },
};

export const sampleProformaXLong: ProformaData = {
  ...sampleProformaLong,
  offerNumber: "TG-2026-0100",
  lines: Array.from({ length: 28 }, (_, i) => ({
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

// Turkish-stress sample. Customer name and product names use the six glyphs
// (ş Ş ı İ ğ Ğ) that the legacy WinAnsi pipeline transliterated. If a
// font with full Turkish coverage is registered, these should render as
// the originals in the generated PDF.
export const sampleProformaTurkish: ProformaData = {
  ...sampleProformaLong,
  offerNumber: "TG-2026-0123",
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
      description:
        "Standart boy 6 m, ±2 mm tolerans. İhtiyaç halinde özel uzunluklarda üretilebilir.",
      unit: "kg",
      quantity: 12500,
      unitPrice: 1.85,
      photoUrl: null,
    },
    {
      lineNumber: 2,
      productName: "Galvanizli bağlantı elemanı (DİN 7991, M8)",
      description: "Paslanmaz, ısıl işlem görmüş.",
      unit: "pcs",
      quantity: 4000,
      unitPrice: 0.42,
      photoUrl: null,
    },
    {
      lineNumber: 3,
      productName: "Yüksek yoğunluklu poliüretan köpük şilte",
      description:
        "120×200 cm, yüksek yoğunluk, çift katlı kumaş kaplı. İğne darbesine dayanıklı.",
      unit: "pcs",
      quantity: 60,
      unitPrice: 245,
      photoUrl: null,
    },
  ],
  notes: {
    remark:
      "Mallar fabrikadan çıkar çıkmaz alıcının riski ve sorumluluğundadır.",
    validity: "Bu teklif düzenleme tarihinden itibaren 30 gün geçerlidir.",
    deliveryLocation: "Ambarlı Limanı, İstanbul, Türkiye",
    productionTime: "Avans tahsilatından sonra 30 iş günü",
    lengthTolerance: "± 2 mm",
    totalWeight: "Yaklaşık 12 800 kg net, 13 200 kg brüt",
  },
};

// Empty-lines edge case: zero items. This should not crash and should
// still render header + grand total of 0.
export const sampleProformaEmpty: ProformaData = {
  ...sampleProformaShort,
  offerNumber: "TG-2026-0150",
  lines: [],
  notes: {
    remark: null,
    validity: null,
    deliveryLocation: null,
    productionTime: null,
    lengthTolerance: null,
    totalWeight: null,
  },
};

export const sampleProformaSingleLine: ProformaData = {
  ...sampleProformaShort,
  offerNumber: "TG-2026-0151",
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
  ],
};
