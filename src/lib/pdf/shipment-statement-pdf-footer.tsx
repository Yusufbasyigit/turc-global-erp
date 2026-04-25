import { Text, View } from "@react-pdf/renderer";
import { statementStyles } from "./shipment-statement-pdf-styles";
import type { StatementData } from "./shipment-statement-pdf-types";

export function ShipmentStatementPdfFooter({ data }: { data: StatementData }) {
  if (!data.hasSkippedCurrencyEvents && !data.isBillingStale) return null;
  return (
    <View style={statementStyles.sectionGap}>
      {data.hasSkippedCurrencyEvents ? (
        <Text style={statementStyles.footnote}>
          Note: certains paiements en devises étrangères ne figurent pas sur ce
          relevé; veuillez nous contacter pour réconciliation.
        </Text>
      ) : null}
      {data.isBillingStale ? (
        <Text style={statementStyles.footnote}>
          Note interne: le montant facturé est en cours de rafraîchissement.
        </Text>
      ) : null}
    </View>
  );
}
