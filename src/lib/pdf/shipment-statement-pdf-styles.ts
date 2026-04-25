import { StyleSheet } from "@react-pdf/renderer";
import {
  ACCENT_RED,
  BORDER,
  CREDIT_GREEN,
  INK,
  MUTED,
  ZEBRA,
  sharedStyles,
} from "./shared-styles";

export { ACCENT_RED, INK, MUTED, BORDER, ZEBRA, CREDIT_GREEN };

const statementSpecific = StyleSheet.create({
  table: { marginTop: 12 },
  colN: { width: 26, textAlign: "center" },
  colProduct: { flex: 4 },
  colQty: { width: 48, textAlign: "right" },
  colUnitPrice: { width: 64, textAlign: "right" },
  colLineTotal: { width: 72, textAlign: "right" },
  colStatus: { width: 110, textAlign: "left" },
  rolledOverNote: {
    color: MUTED,
    fontSize: 7.5,
    fontStyle: "italic",
    marginTop: 1,
  },
  totalsBlock: {
    flexDirection: "column",
    alignItems: "flex-end",
    marginTop: 6,
    gap: 2,
  },
  totalsRow: { flexDirection: "row", alignItems: "baseline" },
  totalsLabel: {
    marginRight: 8,
    color: MUTED,
    fontSize: 9,
  },
  totalsValue: {
    minWidth: 80,
    textAlign: "right",
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
  },
  grandTotalLabel: {
    marginRight: 8,
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
    color: INK,
  },
  grandTotalValue: {
    minWidth: 80,
    textAlign: "right",
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: ACCENT_RED,
  },
  paymentsTable: { marginTop: 4 },
  colPayDate: { width: 72 },
  colPayDesc: { flex: 1 },
  colPayAmount: { width: 96, textAlign: "right" },
  balanceRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderColor: BORDER,
  },
  balanceLabel: {
    marginRight: 8,
    fontFamily: "Helvetica-Bold",
    fontSize: 12,
  },
  balanceValue: {
    minWidth: 100,
    textAlign: "right",
    fontFamily: "Helvetica-Bold",
    fontSize: 12,
  },
  balanceRed: { color: ACCENT_RED },
  balanceGreen: { color: CREDIT_GREEN },
  balanceMuted: { color: MUTED },
  footnote: {
    marginTop: 10,
    fontSize: 8,
    color: MUTED,
    fontStyle: "italic",
  },
  statusNew: { color: INK },
  statusRolled: { color: MUTED },
  statusCancelled: { color: MUTED, textDecoration: "line-through" },
  emptyPayments: {
    padding: 8,
    color: MUTED,
    fontStyle: "italic",
    fontSize: 9,
  },
});

export const statementStyles = {
  ...sharedStyles,
  ...statementSpecific,
};
