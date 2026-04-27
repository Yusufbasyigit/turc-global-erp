import { StyleSheet } from "@react-pdf/renderer";
import {
  BRICK,
  DIM,
  HAIRLINE,
  INK,
  MUTED,
  PAPER,
  PANEL,
  PDF_FONTS,
  POSITIVE,
  RULE,
  ZEBRA,
  sharedStyles,
} from "./shared-styles";

export {
  BRICK,
  DIM,
  HAIRLINE,
  INK,
  MUTED,
  PAPER,
  PANEL,
  POSITIVE,
  RULE,
  ZEBRA,
};
export const ACCENT_RED = BRICK;
export const BORDER = HAIRLINE;
export const CREDIT_GREEN = POSITIVE;

const statementSpecific = StyleSheet.create({
  headerMeta: {
    width: 162,
    paddingLeft: 14,
    borderLeftWidth: 0.4,
    borderColor: HAIRLINE,
  },
  headerMetaKicker: {
    fontFamily: PDF_FONTS.SANS_BOLD,
    fontSize: 8,
    color: MUTED,
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  headerMetaValue: {
    fontFamily: PDF_FONTS.MONO_BOLD,
    fontSize: 11,
    color: INK,
    marginBottom: 8,
  },
  headerMetaSub: {
    fontSize: 8.5,
    color: MUTED,
    marginBottom: 1,
  },

  table: { marginTop: 4 },
  colN: { width: 24, textAlign: "center" },
  colProduct: { flex: 4 },
  colQty: { width: 50, textAlign: "right" },
  colUnitPrice: { width: 70, textAlign: "right" },
  colLineTotal: { width: 80, textAlign: "right" },
  colStatus: { width: 100, textAlign: "left" },
  productName: {
    fontFamily: PDF_FONTS.SANS_BOLD,
    fontSize: 10,
    color: INK,
    marginBottom: 2,
  },
  productMeta: { fontSize: 8.5, color: MUTED },
  rolledOverNote: {
    fontFamily: PDF_FONTS.SERIF_ITALIC,
    color: MUTED,
    fontSize: 9,
    marginTop: 1,
  },

  totalsBlock: {
    flexDirection: "column",
    alignItems: "flex-end",
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 0.4,
    borderColor: HAIRLINE,
    gap: 3,
  },
  totalsRow: {
    flexDirection: "row",
    alignItems: "baseline",
    minWidth: 260,
    justifyContent: "flex-end",
  },
  totalsLabel: {
    marginRight: 14,
    color: MUTED,
    fontSize: 9.5,
  },
  totalsValue: {
    fontFamily: PDF_FONTS.MONO,
    minWidth: 100,
    textAlign: "right",
    fontSize: 9.5,
    color: INK,
  },
  grandTotalRow: {
    flexDirection: "row",
    alignItems: "baseline",
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 0.6,
    borderColor: RULE,
    minWidth: 260,
    justifyContent: "flex-end",
  },
  grandTotalLabel: {
    marginRight: 16,
    fontFamily: PDF_FONTS.SANS_BOLD,
    fontSize: 9,
    color: MUTED,
    letterSpacing: 1.4,
  },
  grandTotalValue: {
    fontFamily: PDF_FONTS.SERIF,
    fontSize: 20,
    color: BRICK,
    minWidth: 110,
    textAlign: "right",
  },

  paymentsTable: { marginTop: 2 },
  colPayDate: { width: 84, paddingLeft: 0 },
  colPayDesc: { flex: 1 },
  colPayAmount: { width: 100, textAlign: "right" },
  payTd: {
    paddingHorizontal: 4,
    paddingVertical: 6,
    fontSize: 9.5,
  },
  payTdMono: {
    paddingHorizontal: 4,
    paddingVertical: 6,
    fontSize: 9.5,
    fontFamily: PDF_FONTS.MONO,
  },

  balanceBlock: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "baseline",
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 0.6,
    borderColor: RULE,
  },
  balanceLabel: {
    marginRight: 16,
    fontFamily: PDF_FONTS.SANS_BOLD,
    fontSize: 9,
    color: MUTED,
    letterSpacing: 1.4,
  },
  balanceValue: {
    fontFamily: PDF_FONTS.SERIF,
    fontSize: 24,
    letterSpacing: 0.3,
  },
  balanceRed: { color: BRICK },
  balanceGreen: { color: POSITIVE },
  balanceMuted: { color: MUTED },

  footnote: {
    fontFamily: PDF_FONTS.SERIF_ITALIC,
    marginTop: 14,
    fontSize: 9.5,
    color: MUTED,
    lineHeight: 1.5,
  },

  statusNew: { color: INK, fontSize: 9 },
  statusRolled: { color: MUTED, fontSize: 9 },
  statusCancelled: {
    color: MUTED,
    fontSize: 9,
    textDecoration: "line-through",
  },
  emptyPayments: {
    fontFamily: PDF_FONTS.SERIF_ITALIC,
    paddingVertical: 10,
    color: MUTED,
    fontSize: 10,
  },

  footer: {
    position: "absolute",
    bottom: 22,
    left: 44,
    right: 44,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7,
    color: DIM,
    letterSpacing: 0.6,
  },
  footerText: { fontFamily: PDF_FONTS.MONO, fontSize: 7, color: DIM },
});

export const statementStyles = {
  ...sharedStyles,
  ...statementSpecific,
};
