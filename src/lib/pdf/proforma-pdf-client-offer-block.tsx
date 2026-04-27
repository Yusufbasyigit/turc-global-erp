import { Text, View } from "@react-pdf/renderer";
import { proformaStyles } from "./proforma-pdf-styles";
import { pdfText } from "./text-encoding";
import type { ProformaData } from "./proforma-pdf-types";

function Kv({
  k,
  v,
  mono,
  strong,
}: {
  k: string;
  v: string | null | undefined;
  mono?: boolean;
  strong?: boolean;
}) {
  if (v === null || v === undefined || v === "") return null;
  const valStyle = mono
    ? proformaStyles.kvValMono
    : strong
    ? proformaStyles.kvValStrong
    : proformaStyles.kvVal;
  return (
    <View style={proformaStyles.kv}>
      <Text style={proformaStyles.kvKey}>{k.toUpperCase()}</Text>
      <Text style={valStyle}>{pdfText(v)}</Text>
    </View>
  );
}

export function ProformaPdfClientOfferBlock({ data }: { data: ProformaData }) {
  const { customer } = data;
  const addressLine = [customer.address, customer.city]
    .filter(Boolean)
    .join(", ");

  return (
    <View style={proformaStyles.twoCol}>
      <View style={proformaStyles.col}>
        <View style={proformaStyles.sectionHead}>
          <Text style={proformaStyles.sectionHeadText}>
            CLIENT · BILL TO
          </Text>
        </View>
        <View>
          <Text style={proformaStyles.partyName}>
            {pdfText(customer.companyName)}
          </Text>
          <Kv k="Contact" v={customer.contactPerson} />
          <Kv k="Adresse" v={addressLine || null} />
          <Kv k="Pays" v={customer.countryName} />
        </View>
      </View>
      <View style={proformaStyles.twoColDivider} />
      <View style={proformaStyles.col}>
        <View style={proformaStyles.sectionHead}>
          <Text style={proformaStyles.sectionHeadText}>
            DÉTAILS DE L&apos;OFFRE
          </Text>
        </View>
        <View>
          <Kv k="Devise" v={data.currency} />
          <Kv k="Incoterm" v={data.incoterm} />
          <Kv k="Livraison" v={data.deliveryTimeline} />
          <Kv k="Paiement" v={data.paymentTerms} />
        </View>
      </View>
    </View>
  );
}
