import { Image, Text, View } from "@react-pdf/renderer";
import { statementStyles } from "./shipment-statement-pdf-styles";
import { formatOfferDateShort } from "@/lib/proforma/istanbul-date";
import { pdfText } from "./text-encoding";
import { PDF_BRAND_LOGO_SRC } from "./pdf-assets";
import type { StatementData } from "./shipment-statement-pdf-types";

export function ShipmentStatementPdfHeader({ data }: { data: StatementData }) {
  return (
    <View>
      <View style={statementStyles.brandBanner}>
        {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image is not a DOM img */}
        <Image src={PDF_BRAND_LOGO_SRC} style={statementStyles.brandLogo} />
      </View>

      <View style={statementStyles.letterhead}>
        <View style={statementStyles.letterheadCol}>
          <Text style={statementStyles.kicker}>EXPÉDITEUR · FROM</Text>
          <Text style={[statementStyles.companyName, { marginTop: 4 }]}>
            {pdfText("Turc Global Danışmanlık ve Dış Ticaret LTD. ŞTİ.")}
          </Text>
          <Text style={statementStyles.muted}>
            {pdfText("Çobançeşme Mah., Sanayi Cad. Vadi Sk. No:5")}
          </Text>
          <Text style={statementStyles.muted}>
            {pdfText("34196 Bahçelievler · İstanbul · Türkiye")}
          </Text>
          <Text style={statementStyles.muted}>
            T +90 530 927 57 89 · E info@turcglobal.com
          </Text>
        </View>
        <View style={statementStyles.letterheadColRight}>
          <Text style={statementStyles.kicker}>N° ENVOI</Text>
          <Text style={[statementStyles.headerMetaValue, { marginTop: 2 }]}>
            {pdfText(data.shipment.name)}
          </Text>
          {data.shipment.etdDate ? (
            <Text style={statementStyles.mutedRight}>
              ETD {formatOfferDateShort(data.shipment.etdDate)}
            </Text>
          ) : null}
          {data.shipment.etaDate ? (
            <Text style={statementStyles.mutedRight}>
              ETA {formatOfferDateShort(data.shipment.etaDate)}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={statementStyles.titleBlock}>
        <Text style={statementStyles.title}>
          RELEVÉ{" "}
          <Text style={statementStyles.titleAccent}>d&apos;envoi</Text>
        </Text>
        <Text style={statementStyles.titleSub}>SHIPMENT STATEMENT</Text>
      </View>
    </View>
  );
}
