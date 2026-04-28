import { Image, Text, View } from "@react-pdf/renderer";
import { proformaStyles } from "./proforma-pdf-styles";
import { formatOfferDateShort } from "@/lib/proforma/istanbul-date";
import { pdfText } from "./text-encoding";
import { PDF_BRAND_LOGO_SRC } from "./pdf-assets";
import type { ProformaData } from "./proforma-pdf-types";

export function ProformaPdfHeader({ data }: { data: ProformaData }) {
  return (
    <View>
      <View style={proformaStyles.brandBanner}>
        {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image is not a DOM img */}
        <Image src={PDF_BRAND_LOGO_SRC} style={proformaStyles.brandLogo} />
      </View>

      <View style={proformaStyles.letterhead}>
        <View style={proformaStyles.letterheadCol}>
          <Text style={proformaStyles.kicker}>EXPÉDITEUR · FROM</Text>
          <Text style={[proformaStyles.companyName, { marginTop: 4 }]}>
            {pdfText("Turc Global Danışmanlık ve Dış Ticaret LTD. ŞTİ.")}
          </Text>
          <Text style={proformaStyles.muted}>
            {pdfText("Çobançeşme Mah., Sanayi Cad. Vadi Sk. No:5")}
          </Text>
          <Text style={proformaStyles.muted}>
            {pdfText("34196 Bahçelievler · İstanbul · Türkiye")}
          </Text>
          <Text style={proformaStyles.muted}>
            T +90 530 927 57 89 · E info@turcglobal.com
          </Text>
        </View>
        <View style={proformaStyles.letterheadColRight}>
          <Text style={proformaStyles.kicker}>N° OFFRE</Text>
          <Text style={[proformaStyles.headerMetaValue, { marginTop: 2 }]}>
            {pdfText(data.offerNumber)}
          </Text>
          {data.offerDate ? (
            <Text style={proformaStyles.mutedRight}>
              Émis le {formatOfferDateShort(data.offerDate)}
            </Text>
          ) : null}
          {data.offerValidUntil ? (
            <Text style={proformaStyles.mutedRight}>
              Valable jusqu&apos;au {formatOfferDateShort(data.offerValidUntil)}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={proformaStyles.titleBlock}>
        <Text style={proformaStyles.title}>
          PROFORMA{" "}
          <Text style={proformaStyles.titleAccent}>Invoice</Text>
        </Text>
        <Text style={proformaStyles.titleSub}>OFFRE COMMERCIALE</Text>
      </View>
    </View>
  );
}
