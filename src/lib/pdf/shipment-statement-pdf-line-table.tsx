import { Text, View } from "@react-pdf/renderer";
import { statementStyles } from "./shipment-statement-pdf-styles";
import {
  formatProformaMoney,
  formatProformaQty,
} from "@/lib/proforma/proforma-money";
import type { StatementData, StatementLine } from "./shipment-statement-pdf-types";

function statusCell(line: StatementLine) {
  if (line.status === "rolled_over") {
    return {
      label: line.rolledOverToName
        ? `Facturé sur ${line.rolledOverToName}`
        : "Facturé ailleurs",
      style: statementStyles.statusRolled,
    };
  }
  if (line.status === "cancelled") {
    return { label: "Annulé", style: statementStyles.statusCancelled };
  }
  return { label: "Nouveau", style: statementStyles.statusNew };
}

function LineRow({
  line,
  zebra,
  currency,
}: {
  line: StatementLine;
  zebra: boolean;
  currency: string;
}) {
  const status = statusCell(line);
  const isRolled = line.status === "rolled_over";
  return (
    <View
      style={[statementStyles.tRow, zebra ? statementStyles.tRowZebra : {}]}
    >
      <View style={[statementStyles.td, statementStyles.colN]}>
        <Text>{line.lineNumber}</Text>
      </View>
      <View style={[statementStyles.td, statementStyles.colProduct]}>
        <Text style={{ fontFamily: "Helvetica-Bold" }}>{line.productName}</Text>
        {line.unit ? (
          <Text style={statementStyles.muted}>{line.unit}</Text>
        ) : null}
      </View>
      <View style={[statementStyles.td, statementStyles.colQty]}>
        <Text>{formatProformaQty(line.quantity)}</Text>
      </View>
      <View style={[statementStyles.td, statementStyles.colUnitPrice]}>
        <Text>
          {isRolled || line.unitPrice === null
            ? "—"
            : formatProformaMoney(line.unitPrice, currency)}
        </Text>
      </View>
      <View style={[statementStyles.td, statementStyles.colLineTotal]}>
        <Text>
          {isRolled || line.lineTotal === null
            ? "—"
            : formatProformaMoney(line.lineTotal, currency)}
        </Text>
      </View>
      <View style={[statementStyles.td, statementStyles.colStatus]}>
        <Text style={status.style}>{status.label}</Text>
      </View>
    </View>
  );
}

export function ShipmentStatementPdfLineTable({
  data,
}: {
  data: StatementData;
}) {
  const currency = data.shipment.invoiceCurrency;
  const hasFreight = data.shipment.freightCost > 0;
  const freightLabel = data.shipment.containerType
    ? `Fret maritime (${data.shipment.containerType})`
    : "Fret maritime";

  return (
    <View style={statementStyles.table}>
      <View style={statementStyles.tHead}>
        <Text style={[statementStyles.th, statementStyles.colN]}>N°</Text>
        <Text style={[statementStyles.th, statementStyles.colProduct]}>
          Produit
        </Text>
        <Text style={[statementStyles.th, statementStyles.colQty]}>Qté</Text>
        <Text style={[statementStyles.th, statementStyles.colUnitPrice]}>
          Prix unit.
        </Text>
        <Text style={[statementStyles.th, statementStyles.colLineTotal]}>
          Total
        </Text>
        <Text style={[statementStyles.th, statementStyles.colStatus]}>
          Statut
        </Text>
      </View>
      {data.lines.map((line, i) => (
        <LineRow
          key={`${line.lineNumber}-${line.productName}`}
          line={line}
          zebra={i % 2 === 1}
          currency={currency}
        />
      ))}

      <View style={statementStyles.totalsBlock}>
        <View style={statementStyles.totalsRow}>
          <Text style={statementStyles.totalsLabel}>Sous-total:</Text>
          <Text style={statementStyles.totalsValue}>
            {formatProformaMoney(data.goodsSubtotal, currency)}
          </Text>
        </View>
        {hasFreight ? (
          <View style={statementStyles.totalsRow}>
            <Text style={statementStyles.totalsLabel}>{freightLabel}:</Text>
            <Text style={statementStyles.totalsValue}>
              {formatProformaMoney(data.shipment.freightCost, currency)}
            </Text>
          </View>
        ) : null}
        <View style={statementStyles.totalsRow}>
          <Text style={statementStyles.grandTotalLabel}>Grand Total:</Text>
          <Text style={statementStyles.grandTotalValue}>
            {formatProformaMoney(data.grandTotal, currency)}
          </Text>
        </View>
      </View>
    </View>
  );
}
