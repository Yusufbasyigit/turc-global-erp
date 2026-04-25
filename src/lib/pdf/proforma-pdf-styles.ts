import { StyleSheet } from "@react-pdf/renderer";
import {
  ACCENT_RED,
  BORDER,
  INK,
  MUTED,
  ZEBRA,
  sharedStyles,
} from "./shared-styles";

export { ACCENT_RED, INK, MUTED, BORDER, ZEBRA };

const proformaSpecific = StyleSheet.create({
  table: { marginTop: 12 },
  colN: { width: 22, textAlign: "center" },
  colType: { flex: 3 },
  colPhoto: { width: 80, alignItems: "center", justifyContent: "center" },
  colUnit: { width: 48, textAlign: "center" },
  colQty: { width: 52, textAlign: "right" },
  colPrice: { width: 60, textAlign: "right" },
  colTotal: { width: 72, textAlign: "right" },
  photo: { width: 72, height: 72, objectFit: "contain" },
  grandTotalRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 6,
  },
  grandTotalLabel: {
    fontFamily: "Helvetica-Bold",
    marginRight: 8,
  },
  grandTotalValue: {
    fontFamily: "Helvetica-Bold",
    color: ACCENT_RED,
  },
});

export const proformaStyles = {
  ...sharedStyles,
  ...proformaSpecific,
};
