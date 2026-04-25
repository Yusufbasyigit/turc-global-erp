import { Text, View } from "@react-pdf/renderer";
import { proformaStyles } from "./proforma-pdf-styles";
import type { ProformaData } from "./proforma-pdf-types";

function NoteRow({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  if (!value) return null;
  return (
    <View style={proformaStyles.kv}>
      <Text style={proformaStyles.kvKey}>{label}</Text>
      <Text style={proformaStyles.kvVal}>{value}</Text>
    </View>
  );
}

export function ProformaPdfNotesBlock({ data }: { data: ProformaData }) {
  const n = data.notes;
  const anyNote =
    n.remark ||
    n.validity ||
    n.deliveryLocation ||
    n.productionTime ||
    n.lengthTolerance ||
    n.totalWeight;
  if (!anyNote) return null;

  return (
    <View style={proformaStyles.sectionGap}>
      <Text style={proformaStyles.bar}>Notes / Conditions</Text>
      <View style={proformaStyles.blockBody}>
        <NoteRow label="Remarque" value={n.remark} />
        <NoteRow label="Validité de l'offre" value={n.validity} />
        <NoteRow label="Lieu de livraison" value={n.deliveryLocation} />
        <NoteRow label="Temps de production" value={n.productionTime} />
        <NoteRow label="Tolérance de longueur" value={n.lengthTolerance} />
        <NoteRow label="Poids total" value={n.totalWeight} />
      </View>
    </View>
  );
}
