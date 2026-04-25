import { Image, Text, View } from "@react-pdf/renderer";
import { statementStyles } from "./shipment-statement-pdf-styles";

export function ShipmentStatementPdfHeader() {
  return (
    <View style={statementStyles.header}>
      <Image src="/tg-logo.png" style={statementStyles.headerLogo} />
      <View style={{ flex: 1 }}>
        <Text style={statementStyles.companyName}>
          Turc Global Danışmanlık ve Dış Ticaret LTD. ŞTİ.
        </Text>
        <Text style={statementStyles.muted}>
          Çobançeşme Mah., Sanayi Cad. Vadi Sk. No:5, 34196 Bahçelievler –
          İstanbul
        </Text>
        <Text style={statementStyles.muted}>
          T: +90 530 927 57 89 · E: info@turcglobal.com
        </Text>
        <Text style={statementStyles.title}>
          RELEVÉ D&apos;ENVOI / SHIPMENT STATEMENT
        </Text>
      </View>
    </View>
  );
}
