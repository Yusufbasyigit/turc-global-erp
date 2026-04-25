import { Image, Text, View } from "@react-pdf/renderer";
import { proformaStyles } from "./proforma-pdf-styles";

export function ProformaPdfHeader() {
  return (
    <View style={proformaStyles.header}>
      <Image src="/tg-logo.png" style={proformaStyles.headerLogo} />
      <View style={{ flex: 1 }}>
        <Text style={proformaStyles.companyName}>
          Turc Global Danışmanlık ve Dış Ticaret LTD. ŞTİ.
        </Text>
        <Text style={proformaStyles.muted}>
          Çobançeşme Mah., Sanayi Cad. Vadi Sk. No:5, 34196 Bahçelievler –
          İstanbul
        </Text>
        <Text style={proformaStyles.muted}>
          T: +90 530 927 57 89 · E: info@turcglobal.com
        </Text>
        <Text style={proformaStyles.title}>PROFORMA INVOICE / OFFRE</Text>
      </View>
    </View>
  );
}
