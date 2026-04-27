import { Text, View } from "@react-pdf/renderer";
import { proformaStyles } from "./proforma-pdf-styles";
import { pdfText } from "./text-encoding";
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
      <Text style={proformaStyles.kvKey}>{label.toUpperCase()}</Text>
      <Text style={proformaStyles.kvVal}>{pdfText(value)}</Text>
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
      <View style={proformaStyles.sectionHead}>
        <Text style={proformaStyles.sectionHeadText}>
          NOTES · CONDITIONS
        </Text>
      </View>
      <View style={proformaStyles.notesBody}>
        <NoteRow label="Remarque" value={n.remark} />
        <NoteRow label="Validité" value={n.validity} />
        <NoteRow label="Livraison" value={n.deliveryLocation} />
        <NoteRow label="Production" value={n.productionTime} />
        <NoteRow label="Tolérance" value={n.lengthTolerance} />
        <NoteRow label="Poids total" value={n.totalWeight} />
      </View>
    </View>
  );
}
