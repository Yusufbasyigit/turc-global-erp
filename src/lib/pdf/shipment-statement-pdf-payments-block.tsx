import { Text, View } from "@react-pdf/renderer";
import { statementStyles } from "./shipment-statement-pdf-styles";
import { formatProformaMoney } from "@/lib/proforma/proforma-money";
import { formatOfferDateShort } from "@/lib/proforma/istanbul-date";
import { pdfText } from "./text-encoding";
import type { StatementData } from "./shipment-statement-pdf-types";

function BalanceRow({
  balance,
  currency,
}: {
  balance: number;
  currency: string;
}) {
  if (balance > 0) {
    return (
      <View style={statementStyles.balanceBlock}>
        <Text style={statementStyles.balanceLabel}>SOLDE DÛ</Text>
        <Text
          style={[statementStyles.balanceValue, statementStyles.balanceRed]}
        >
          {formatProformaMoney(balance, currency)}
        </Text>
      </View>
    );
  }
  if (balance < 0) {
    return (
      <View style={statementStyles.balanceBlock}>
        <Text style={statementStyles.balanceLabel}>CRÉDIT EN FAVEUR</Text>
        <Text
          style={[statementStyles.balanceValue, statementStyles.balanceGreen]}
        >
          {formatProformaMoney(Math.abs(balance), currency)}
        </Text>
      </View>
    );
  }
  return (
    <View style={statementStyles.balanceBlock}>
      <Text style={statementStyles.balanceLabel}>SOLDE</Text>
      <Text
        style={[statementStyles.balanceValue, statementStyles.balanceMuted]}
      >
        {formatProformaMoney(0, currency)}
      </Text>
    </View>
  );
}

export function ShipmentStatementPdfPaymentsBlock({
  data,
}: {
  data: StatementData;
}) {
  const currency = data.shipment.invoiceCurrency;
  const hasPayments = data.payments.length > 0;

  return (
    <View style={statementStyles.sectionGap}>
      <View style={statementStyles.sectionHead}>
        <Text style={statementStyles.sectionHeadText}>
          PAIEMENTS REÇUS · PAYMENTS RECEIVED
        </Text>
      </View>

      {!hasPayments ? (
        <Text style={statementStyles.emptyPayments}>
          Aucun paiement reçu pour le moment.
        </Text>
      ) : (
        <View style={statementStyles.paymentsTable}>
          <View style={statementStyles.tHead}>
            <Text
              style={[statementStyles.tHeadCell, statementStyles.colPayDate]}
            >
              DATE
            </Text>
            <Text
              style={[statementStyles.tHeadCell, statementStyles.colPayDesc]}
            >
              DESCRIPTION
            </Text>
            <Text
              style={[
                statementStyles.tHeadCell,
                statementStyles.colPayAmount,
              ]}
            >
              MONTANT
            </Text>
          </View>
          {data.payments.map((p, i) => (
            <View
              key={`${p.date}-${i}`}
              style={[
                statementStyles.tRow,
                i % 2 === 1 ? statementStyles.tRowZebra : {},
                { minHeight: 24 },
              ]}
            >
              <View
                style={[statementStyles.payTdMono, statementStyles.colPayDate]}
              >
                <Text>{formatOfferDateShort(p.date)}</Text>
              </View>
              <View
                style={[statementStyles.payTd, statementStyles.colPayDesc]}
              >
                <Text>{pdfText(p.description)}</Text>
                {p.partialAnnotation ? (
                  <Text style={statementStyles.rolledOverNote}>
                    {pdfText(p.partialAnnotation)}
                  </Text>
                ) : null}
              </View>
              <View
                style={[
                  statementStyles.payTdMono,
                  statementStyles.colPayAmount,
                ]}
              >
                <Text>
                  {formatProformaMoney(p.allocatedAmount, currency)}
                </Text>
              </View>
            </View>
          ))}
          <View style={statementStyles.totalsBlock}>
            <View style={statementStyles.totalsRow}>
              <Text style={statementStyles.totalsLabel}>Total reçu</Text>
              <Text style={statementStyles.totalsValue}>
                {formatProformaMoney(data.totalReceived, currency)}
              </Text>
            </View>
          </View>
        </View>
      )}

      <BalanceRow balance={data.balance} currency={currency} />
    </View>
  );
}
