import { Text, View } from "@react-pdf/renderer";
import { proformaStyles } from "./proforma-pdf-styles";
import { formatOfferDateShort } from "@/lib/proforma/istanbul-date";
import type { ProformaData } from "./proforma-pdf-types";

function Kv({ k, v }: { k: string; v: string | null | undefined }) {
  if (v === null || v === undefined || v === "") return null;
  return (
    <View style={proformaStyles.kv}>
      <Text style={proformaStyles.kvKey}>{k}</Text>
      <Text style={proformaStyles.kvVal}>{v}</Text>
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
        <Text style={proformaStyles.bar}>Client</Text>
        <View style={proformaStyles.blockBody}>
          <Kv k="Nom" v={customer.companyName} />
          <Kv k="Contact" v={customer.contactPerson} />
          <Kv k="Adresse" v={addressLine || null} />
          <Kv k="Pays" v={customer.countryName} />
        </View>
      </View>
      <View style={proformaStyles.col}>
        <Text style={proformaStyles.bar}>Détails de l&apos;offre</Text>
        <View style={proformaStyles.blockBody}>
          <Kv k="N° Offre" v={data.offerNumber} />
          <Kv k="Date" v={formatOfferDateShort(data.offerDate)} />
          <Kv k="Validité" v={formatOfferDateShort(data.offerValidUntil)} />
          <Kv k="Devise" v={data.currency} />
          <Kv k="Incoterm" v={data.incoterm} />
          <Kv k="Délai de livraison" v={data.deliveryTimeline} />
          <Kv k="Conditions de paiement" v={data.paymentTerms} />
        </View>
      </View>
    </View>
  );
}
