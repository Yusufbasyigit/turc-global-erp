import { Text, View } from "@react-pdf/renderer";
import { statementStyles } from "./shipment-statement-pdf-styles";
import { pdfText } from "./text-encoding";
import type { StatementData } from "./shipment-statement-pdf-types";

function Kv({
  k,
  v,
  mono,
  strong,
}: {
  k: string;
  v: string | null | undefined;
  mono?: boolean;
  strong?: boolean;
}) {
  if (v === null || v === undefined || v === "") return null;
  const valStyle = mono
    ? statementStyles.kvValMono
    : strong
    ? statementStyles.kvValStrong
    : statementStyles.kvVal;
  return (
    <View style={statementStyles.kv}>
      <Text style={statementStyles.kvKey}>{k.toUpperCase()}</Text>
      <Text style={valStyle}>{pdfText(v)}</Text>
    </View>
  );
}

export function ShipmentStatementPdfClientShipmentBlock({
  data,
}: {
  data: StatementData;
}) {
  const { customer, shipment } = data;
  const addressLine = [customer.address, customer.city]
    .filter(Boolean)
    .join(", ");

  return (
    <View style={statementStyles.twoCol}>
      <View style={statementStyles.col}>
        <View style={statementStyles.sectionHead}>
          <Text style={statementStyles.sectionHeadText}>
            CLIENT · BILL TO
          </Text>
        </View>
        <View>
          <Text style={statementStyles.partyName}>
            {pdfText(customer.companyName)}
          </Text>
          <Kv k="Contact" v={customer.contactPerson} />
          <Kv k="Adresse" v={addressLine || null} />
          <Kv k="Pays" v={customer.countryName} />
          <Kv k="N° fiscal" v={customer.taxId} mono />
        </View>
      </View>
      <View style={statementStyles.twoColDivider} />
      <View style={statementStyles.col}>
        <View style={statementStyles.sectionHead}>
          <Text style={statementStyles.sectionHeadText}>
            DÉTAILS DE L&apos;ENVOI
          </Text>
        </View>
        <View>
          <Kv k="Container" v={shipment.containerType} strong />
          <Kv k="Tracking" v={shipment.trackingNumber} mono />
          <Kv k="Devise" v={shipment.invoiceCurrency} mono />
        </View>
      </View>
    </View>
  );
}
