import { Text, View } from "@react-pdf/renderer";
import { statementStyles } from "./shipment-statement-pdf-styles";
import { formatProformaMoney } from "@/lib/proforma/proforma-money";
import { formatOfferDateShort } from "@/lib/proforma/istanbul-date";
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
      <View style={statementStyles.balanceRow}>
        <Text style={[statementStyles.balanceLabel, statementStyles.balanceRed]}>
          BALANCE:
        </Text>
        <Text style={[statementStyles.balanceValue, statementStyles.balanceRed]}>
          {formatProformaMoney(balance, currency)}
        </Text>
      </View>
    );
  }
  if (balance < 0) {
    return (
      <View style={statementStyles.balanceRow}>
        <Text
          style={[statementStyles.balanceLabel, statementStyles.balanceGreen]}
        >
          Crédit:
        </Text>
        <Text
          style={[statementStyles.balanceValue, statementStyles.balanceGreen]}
        >
          {formatProformaMoney(Math.abs(balance), currency)}
        </Text>
      </View>
    );
  }
  return (
    <View style={statementStyles.balanceRow}>
      <Text style={[statementStyles.balanceLabel, statementStyles.balanceMuted]}>
        Solde:
      </Text>
      <Text style={[statementStyles.balanceValue, statementStyles.balanceMuted]}>
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
      <Text style={statementStyles.bar}>Paiements reçus</Text>
      <View style={statementStyles.blockBody}>
        {!hasPayments ? (
          <Text style={statementStyles.emptyPayments}>
            Aucun paiement reçu pour le moment.
          </Text>
        ) : (
          <View style={statementStyles.paymentsTable}>
            {data.payments.map((p, i) => (
              <View
                key={`${p.date}-${i}`}
                style={[
                  statementStyles.tRow,
                  i % 2 === 1 ? statementStyles.tRowZebra : {},
                  { minHeight: 22 },
                ]}
              >
                <View style={[statementStyles.td, statementStyles.colPayDate]}>
                  <Text>{formatOfferDateShort(p.date)}</Text>
                </View>
                <View style={[statementStyles.td, statementStyles.colPayDesc]}>
                  <Text>{p.description}</Text>
                  {p.partialAnnotation ? (
                    <Text style={statementStyles.rolledOverNote}>
                      {p.partialAnnotation}
                    </Text>
                  ) : null}
                </View>
                <View style={[statementStyles.td, statementStyles.colPayAmount]}>
                  <Text>
                    {formatProformaMoney(p.allocatedAmount, currency)}
                  </Text>
                </View>
              </View>
            ))}
            <View style={[statementStyles.totalsBlock, { marginTop: 4 }]}>
              <View style={statementStyles.totalsRow}>
                <Text style={statementStyles.totalsLabel}>Total reçu:</Text>
                <Text style={statementStyles.totalsValue}>
                  {formatProformaMoney(data.totalReceived, currency)}
                </Text>
              </View>
            </View>
          </View>
        )}
      </View>
      <BalanceRow balance={data.balance} currency={currency} />
    </View>
  );
}
