import { Document, Page } from "@react-pdf/renderer";
import { proformaStyles } from "./proforma-pdf-styles";
import { ProformaPdfHeader } from "./proforma-pdf-header";
import { ProformaPdfClientOfferBlock } from "./proforma-pdf-client-offer-block";
import { ProformaPdfLineTable } from "./proforma-pdf-line-table";
import { ProformaPdfNotesBlock } from "./proforma-pdf-notes-block";
import type { ProformaData } from "./proforma-pdf-types";

export function ProformaDocument({ data }: { data: ProformaData }) {
  return (
    <Document
      title={`Proforma ${data.offerNumber}`}
      author="Turc Global"
      subject="Proforma Invoice"
    >
      <Page size="A4" style={proformaStyles.page}>
        <ProformaPdfHeader />
        <ProformaPdfClientOfferBlock data={data} />
        <ProformaPdfLineTable data={data} />
        <ProformaPdfNotesBlock data={data} />
      </Page>
    </Document>
  );
}
