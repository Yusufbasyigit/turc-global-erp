/**
 * Render every document the app produces with realistic sample data so we can
 * eyeball the formatting. Outputs to OUT_DIR (default samples/before).
 *
 * Run with: npx tsx scripts/render-sample-pdfs.tsx [outDir]
 */
import * as fs from "node:fs";
import * as path from "node:path";

// Override the brand logo path so the PDF generator reads the bundled
// public/logo.png instead of the browser-only /logo.png URL. Must run
// before importing the PDF documents.
process.env.PDF_LOGO_OVERRIDE = path.resolve("public/logo.png");

const OUT_DIR = path.resolve(process.argv[2] ?? "samples/before");
fs.mkdirSync(OUT_DIR, { recursive: true });

async function main() {
  const { pdf } = await import("@react-pdf/renderer");
  const { ProformaDocument } = await import("@/lib/pdf/proforma-pdf");
  const { ShipmentStatementDocument } = await import(
    "@/lib/pdf/shipment-statement-pdf"
  );
  const { buildKdvCsv } = await import("@/features/tax/csv");
  const {
    buildProformaPdfFilename,
    buildStatementPdfFilename,
    buildKdvCsvFilename,
  } = await import("@/lib/pdf/document-filenames");
  const { sampleProformaLong, sampleProformaShort, sampleProformaXLong, sampleProformaTurkish, sampleProformaEmpty, sampleProformaSingleLine } =
    await import("./sample-data/proforma-samples");
  const { sampleStatementLong, sampleStatementNoPayments, sampleStatementCredit, sampleStatementTurkish } =
    await import("./sample-data/statement-samples");
  const { sampleKdvRows } = await import("./sample-data/kdv-samples");

  type DocumentReactElement = Parameters<typeof pdf>[0];

  async function render(name: string, doc: DocumentReactElement) {
    const outPath = path.join(OUT_DIR, `${name}.pdf`);
    const blob = await pdf(doc).toBlob();
    const buf = Buffer.from(await blob.arrayBuffer());
    fs.writeFileSync(outPath, buf);
    console.log(`  ${name}.pdf  (${(buf.length / 1024).toFixed(1)} KB)`);
  }

  function writeCsv(name: string, csv: string) {
    const outPath = path.join(OUT_DIR, `${name}.csv`);
    // Mirror the runtime download path: UTF-8 BOM + the CSV body.
    fs.writeFileSync(outPath, "﻿" + csv, "utf8");
    console.log(`  ${name}.csv  (${csv.length} bytes)`);
  }

  console.log(`Writing samples to ${OUT_DIR}`);

  await render("proforma-long", <ProformaDocument data={sampleProformaLong} />);
  await render("proforma-short", <ProformaDocument data={sampleProformaShort} />);
  await render("proforma-xlong-pagination", <ProformaDocument data={sampleProformaXLong} />);
  await render("proforma-turkish-customer", <ProformaDocument data={sampleProformaTurkish} />);
  await render("proforma-empty-lines", <ProformaDocument data={sampleProformaEmpty} />);
  await render("proforma-single-line", <ProformaDocument data={sampleProformaSingleLine} />);

  await render(
    "statement-long",
    <ShipmentStatementDocument data={sampleStatementLong} />,
  );
  await render(
    "statement-no-payments",
    <ShipmentStatementDocument data={sampleStatementNoPayments} />,
  );
  await render(
    "statement-credit",
    <ShipmentStatementDocument data={sampleStatementCredit} />,
  );
  await render(
    "statement-turkish-customer",
    <ShipmentStatementDocument data={sampleStatementTurkish} />,
  );

  // KDV CSV — exercise both the normal case and one with non-TRY skipped
  // rows so the "non-TRY rows omitted" comment line is visible.
  const period = "2026-04";
  const { csv } = buildKdvCsv(sampleKdvRows, period);
  writeCsv(`kdv-${period}`, csv);

  // Filename samples — record what the app would name each download so we
  // can compare before/after.
  const filenameLines: string[] = [
    `proforma  → ${buildProformaPdfFilename({
      offerNumber: sampleProformaLong.offerNumber,
      customerName: sampleProformaLong.customer.companyName,
      offerDate: sampleProformaLong.offerDate,
    })}`,
    `proforma (Turkish customer) → ${buildProformaPdfFilename({
      offerNumber: sampleProformaTurkish.offerNumber,
      customerName: sampleProformaTurkish.customer.companyName,
      offerDate: sampleProformaTurkish.offerDate,
    })}`,
    `statement → ${buildStatementPdfFilename({
      shipmentName: sampleStatementLong.shipment.name,
      customerName: sampleStatementLong.customer.companyName,
      etdDate: sampleStatementLong.shipment.etdDate,
    })}`,
    `statement (Turkish customer) → ${buildStatementPdfFilename({
      shipmentName: sampleStatementTurkish.shipment.name,
      customerName: sampleStatementTurkish.customer.companyName,
      etdDate: sampleStatementTurkish.shipment.etdDate,
    })}`,
    `kdv       → ${buildKdvCsvFilename(period)}`,
  ];
  fs.writeFileSync(path.join(OUT_DIR, "_filenames.txt"), filenameLines.join("\n") + "\n");
  console.log(`  _filenames.txt`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
