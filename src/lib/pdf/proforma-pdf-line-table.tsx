import { Image, Text, View } from "@react-pdf/renderer";
import { proformaStyles } from "./proforma-pdf-styles";
import {
  formatProformaMoney,
  formatProformaQty,
} from "@/lib/proforma/proforma-money";
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
      <View style={[proformaStyles.td, proformaStyles.colN]}>
        <Text>{line.lineNumber}</Text>
      </View>
      <View style={[proformaStyles.td, proformaStyles.colType]}>
        <Text style={{ fontFamily: "Helvetica-Bold" }}>{line.productName}</Text>
        {line.description ? (
          <Text style={{ color: "#555", marginTop: 2 }}>{line.description}</Text>
        ) : null}
      </View>
      <View style={[proformaStyles.td, proformaStyles.colPhoto]}>
        {line.photoUrl ? (
          <Image src={line.photoUrl} style={proformaStyles.photo} />
        ) : null}
      </View>
      <View style={[proformaStyles.td, proformaStyles.colUnit]}>
        <Text>{line.unit ?? "—"}</Text>
      </View>
      <View style={[proformaStyles.td, proformaStyles.colQty]}>
        <Text>{formatProformaQty(line.quantity)}</Text>
      </View>
      <View style={[proformaStyles.td, proformaStyles.colPrice]}>
        <Text>{formatProformaMoney(line.unitPrice, currency)}</Text>
      </View>
      <View style={[proformaStyles.td, proformaStyles.colTotal]}>
        <Text>{formatProformaMoney(lineTotal, currency)}</Text>
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
    <View style={proformaStyles.table}>
      <View style={proformaStyles.tHead}>
        <Text style={[proformaStyles.th, proformaStyles.colN]}>N°</Text>
        <Text style={[proformaStyles.th, proformaStyles.colType]}>Type</Text>
        <Text style={[proformaStyles.th, proformaStyles.colPhoto]}>Photo</Text>
        <Text style={[proformaStyles.th, proformaStyles.colUnit]}>Unité</Text>
        <Text style={[proformaStyles.th, proformaStyles.colQty]}>Quantité</Text>
        <Text style={[proformaStyles.th, proformaStyles.colPrice]}>Prix u.</Text>
        <Text style={[proformaStyles.th, proformaStyles.colTotal]}>Total</Text>
      </View>
      {data.lines.map((line, i) => (
        <LineRow
          key={line.lineNumber}
          line={line}
          zebra={i % 2 === 1}
          currency={data.currency}
        />
      ))}
      <View style={proformaStyles.grandTotalRow}>
        <Text style={proformaStyles.grandTotalLabel}>Grand Total:</Text>
        <Text style={proformaStyles.grandTotalValue}>
          {formatProformaMoney(grandTotal, data.currency)}
        </Text>
      </View>
    </View>
  );
}
