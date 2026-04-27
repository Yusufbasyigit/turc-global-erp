import { Image, Text, View } from "@react-pdf/renderer";
import { proformaStyles } from "./proforma-pdf-styles";
import {
  formatProformaMoney,
  formatProformaQty,
} from "@/lib/proforma/proforma-money";
import { pdfText } from "./text-encoding";
import type { ProformaData, ProformaLine } from "./proforma-pdf-types";

function LineRow({
  line,
  zebra,
  currency,
}: {
  line: ProformaLine;
  zebra: boolean;
  currency: string;
}) {
  const lineTotal = Number(line.quantity) * Number(line.unitPrice);
  return (
    <View
      style={[proformaStyles.tRow, zebra ? proformaStyles.tRowZebra : {}]}
    >
      <View style={[proformaStyles.tdMono, proformaStyles.colN]}>
        <Text>{line.lineNumber}</Text>
      </View>
      <View style={[proformaStyles.td, proformaStyles.colType]}>
        <Text style={proformaStyles.productName}>
          {pdfText(line.productName)}
        </Text>
        {line.description ? (
          <Text style={proformaStyles.productDesc}>
            {pdfText(line.description)}
          </Text>
        ) : null}
      </View>
      <View style={[proformaStyles.td, proformaStyles.colPhoto]}>
        {line.photoUrl ? (
          // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image is not a DOM img
          <Image src={line.photoUrl} style={proformaStyles.photo} />
        ) : (
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 3,
              borderWidth: 0.4,
              borderColor: "#D8D2C5",
              borderStyle: "dashed",
            }}
          />
        )}
      </View>
      <View style={[proformaStyles.td, proformaStyles.colUnit]}>
        <Text style={{ color: "#6B6963" }}>{pdfText(line.unit ?? "—")}</Text>
      </View>
      <View style={[proformaStyles.tdMono, proformaStyles.colQty]}>
        <Text>{formatProformaQty(line.quantity)}</Text>
      </View>
      <View style={[proformaStyles.tdMono, proformaStyles.colPrice]}>
        <Text>{formatProformaMoney(line.unitPrice, currency)}</Text>
      </View>
      <View style={[proformaStyles.tdMono, proformaStyles.colTotal]}>
        <Text style={{ fontFamily: "Courier-Bold" }}>
          {formatProformaMoney(lineTotal, currency)}
        </Text>
      </View>
    </View>
  );
}

export function ProformaPdfLineTable({ data }: { data: ProformaData }) {
  const grandTotal = data.lines.reduce(
    (sum, l) => sum + Number(l.quantity) * Number(l.unitPrice),
    0,
  );

  return (
    <View style={[proformaStyles.sectionGap, proformaStyles.table]}>
      <View style={proformaStyles.sectionHead}>
        <Text style={proformaStyles.sectionHeadText}>ARTICLES · ITEMS</Text>
      </View>

      <View style={proformaStyles.tHead}>
        <Text style={[proformaStyles.tHeadCell, proformaStyles.colN]}>N°</Text>
        <Text style={[proformaStyles.tHeadCell, proformaStyles.colType]}>
          DÉSIGNATION
        </Text>
        <Text style={[proformaStyles.tHeadCell, proformaStyles.colPhoto]}>
          PHOTO
        </Text>
        <Text style={[proformaStyles.tHeadCell, proformaStyles.colUnit]}>
          UNITÉ
        </Text>
        <Text style={[proformaStyles.tHeadCell, proformaStyles.colQty]}>
          QTÉ
        </Text>
        <Text style={[proformaStyles.tHeadCell, proformaStyles.colPrice]}>
          PRIX U.
        </Text>
        <Text style={[proformaStyles.tHeadCell, proformaStyles.colTotal]}>
          TOTAL
        </Text>
      </View>
      {data.lines.map((line, i) => (
        <LineRow
          key={line.lineNumber}
          line={line}
          zebra={i % 2 === 1}
          currency={data.currency}
        />
      ))}
      <View style={proformaStyles.grandTotalBlock}>
        <Text style={proformaStyles.grandTotalLabel}>GRAND TOTAL</Text>
        <Text style={proformaStyles.grandTotalValue}>
          {formatProformaMoney(grandTotal, data.currency)}
        </Text>
      </View>
    </View>
  );
}
