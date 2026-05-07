import { Document, Page, Text, View } from "@react-pdf/renderer";
import { statementStyles } from "./shipment-statement-pdf-styles";
import { ShipmentStatementPdfHeader } from "./shipment-statement-pdf-header";
import { ShipmentStatementPdfClientShipmentBlock } from "./shipment-statement-pdf-client-shipment-block";
import { ShipmentStatementPdfLineTable } from "./shipment-statement-pdf-line-table";
import { ShipmentStatementPdfPaymentsBlock } from "./shipment-statement-pdf-payments-block";
import { ShipmentStatementPdfFooter } from "./shipment-statement-pdf-footer";
import { pdfText } from "./text-encoding";
import type { StatementData } from "./shipment-statement-pdf-types";

export function ShipmentStatementDocument({ data }: { data: StatementData }) {
  return (
    <Document
      title={`Statement ${data.shipment.name} — ${data.customer.companyName}`}
      author={data.company.name}
      subject={`Shipment statement ${data.shipment.name} for ${data.customer.companyName}`}
      keywords={`statement, shipment, ${data.shipment.name}, ${data.customer.companyName}`}
      creator={`${data.company.name} ERP`}
      producer={`${data.company.name} ERP`}
    >
      <Page size="A4" style={statementStyles.page}>
        <ShipmentStatementPdfHeader data={data} />
        <ShipmentStatementPdfClientShipmentBlock data={data} />
        <ShipmentStatementPdfLineTable data={data} />
        <ShipmentStatementPdfPaymentsBlock data={data} />
        <ShipmentStatementPdfFooter data={data} />
        <View style={statementStyles.footer} fixed>
          <Text style={statementStyles.footerText}>
            Turc Global · {pdfText(data.shipment.name)}
          </Text>
          <Text
            style={statementStyles.footerText}
            render={({ pageNumber, totalPages }) =>
              `Page ${pageNumber} / ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}
