import { Document, Page } from "@react-pdf/renderer";
import { statementStyles } from "./shipment-statement-pdf-styles";
import { ShipmentStatementPdfHeader } from "./shipment-statement-pdf-header";
import { ShipmentStatementPdfClientShipmentBlock } from "./shipment-statement-pdf-client-shipment-block";
import { ShipmentStatementPdfLineTable } from "./shipment-statement-pdf-line-table";
import { ShipmentStatementPdfPaymentsBlock } from "./shipment-statement-pdf-payments-block";
import { ShipmentStatementPdfFooter } from "./shipment-statement-pdf-footer";
import type { StatementData } from "./shipment-statement-pdf-types";

export function ShipmentStatementDocument({ data }: { data: StatementData }) {
  return (
    <Document
      title={`Statement ${data.shipment.name}`}
      author="Turc Global"
      subject="Shipment Statement"
    >
      <Page size="A4" style={statementStyles.page}>
        <ShipmentStatementPdfHeader />
        <ShipmentStatementPdfClientShipmentBlock data={data} />
        <ShipmentStatementPdfLineTable data={data} />
        <ShipmentStatementPdfPaymentsBlock data={data} />
        <ShipmentStatementPdfFooter data={data} />
      </Page>
    </Document>
  );
}
