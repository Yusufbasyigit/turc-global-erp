import { Text, View } from "@react-pdf/renderer";
import { statementStyles } from "./shipment-statement-pdf-styles";
import { formatOfferDateShort } from "@/lib/proforma/istanbul-date";
import type { StatementData } from "./shipment-statement-pdf-types";

function Kv({ k, v }: { k: string; v: string | null | undefined }) {
  if (v === null || v === undefined || v === "") return null;
  return (
    <View style={statementStyles.kv}>
      <Text style={statementStyles.kvKey}>{k}</Text>
      <Text style={statementStyles.kvVal}>{v}</Text>
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
        <Text style={statementStyles.bar}>Client</Text>
        <View style={statementStyles.blockBody}>
          <Kv k="Nom" v={customer.companyName} />
          <Kv k="Contact" v={customer.contactPerson} />
          <Kv k="Adresse" v={addressLine || null} />
          <Kv k="Pays" v={customer.countryName} />
        </View>
      </View>
      <View style={statementStyles.col}>
        <Text style={statementStyles.bar}>Détails de l&apos;envoi</Text>
        <View style={statementStyles.blockBody}>
          <Kv k="N° Envoi" v={shipment.name} />
          <Kv k="Container" v={shipment.containerType} />
          <Kv k="Tracking" v={shipment.trackingNumber} />
          <Kv k="ETD" v={formatOfferDateShort(shipment.etdDate)} />
          <Kv k="ETA" v={formatOfferDateShort(shipment.etaDate)} />
          <Kv k="Devise" v={shipment.invoiceCurrency} />
        </View>
      </View>
    </View>
  );
}
