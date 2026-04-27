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
  RULE,
  ZEBRA,
  sharedStyles,
} from "./shared-styles";

export { BRICK, DIM, INK, MUTED, HAIRLINE, PAPER, PANEL, ZEBRA, RULE };

const proformaSpecific = StyleSheet.create({
  // Header right rail — small offer-number callout opposite the logo lockup.
  headerMeta: {
    width: 152,
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

  // Line table
  table: { marginTop: 4 },
  colN: { width: 22, textAlign: "center" },
  colType: { flex: 3 },
  colPhoto: {
    width: 64,
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
  },
  colUnit: { width: 38, textAlign: "center" },
  colQty: { width: 56, textAlign: "right" },
  colPrice: { width: 64, textAlign: "right" },
  colTotal: { width: 78, textAlign: "right" },
  photo: {
    width: 56,
    height: 56,
    objectFit: "contain",
    backgroundColor: PANEL,
    borderRadius: 3,
  },
  productName: {
    fontFamily: PDF_FONTS.SANS_BOLD,
    fontSize: 10,
    color: INK,
    marginBottom: 2,
  },
  productDesc: {
    fontSize: 8.5,
    color: MUTED,
    lineHeight: 1.45,
  },

  // Grand total — serif emphasis figure aligned right.
  grandTotalBlock: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 0.6,
    borderColor: RULE,
  },
  grandTotalLabel: {
    fontFamily: PDF_FONTS.SANS_BOLD,
    fontSize: 9,
    color: MUTED,
    letterSpacing: 1.4,
    marginRight: 18,
  },
  grandTotalValue: {
    fontFamily: PDF_FONTS.SERIF,
    fontSize: 22,
    color: BRICK,
    letterSpacing: 0.3,
    lineHeight: 1,
  },

  notesBody: { paddingTop: 2 },

  // Footer — small mono line at bottom of page.
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

export const proformaStyles = {
  ...sharedStyles,
  ...proformaSpecific,
};
