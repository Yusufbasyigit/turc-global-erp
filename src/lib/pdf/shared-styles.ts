import { StyleSheet } from "@react-pdf/renderer";

// TODO: Yusuf to confirm brand red exact hex.
export const ACCENT_RED = "#A52A2A";
export const INK = "#111111";
export const MUTED = "#555555";
export const BORDER = "#DDDDDD";
export const ZEBRA = "#F7F7F7";
export const CREDIT_GREEN = "#15803D";

export const sharedStyles = StyleSheet.create({
  page: {
    padding: 32,
    fontFamily: "Helvetica",
    fontSize: 9,
    color: INK,
    backgroundColor: "#FFFFFF",
  },
  row: { flexDirection: "row" },
  title: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: ACCENT_RED,
    marginTop: 4,
  },
  header: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  headerLogo: { width: 60, height: 60, objectFit: "contain" },
  companyName: { fontSize: 11, fontFamily: "Helvetica-Bold" },
  muted: { color: MUTED },
  sectionGap: { marginTop: 12 },
  bar: {
    backgroundColor: ACCENT_RED,
    color: "#FFFFFF",
    paddingVertical: 4,
    paddingHorizontal: 6,
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
  },
  blockBody: {
    borderWidth: 1,
    borderColor: BORDER,
    borderTopWidth: 0,
    padding: 6,
  },
  twoCol: { flexDirection: "row", gap: 8, marginTop: 8 },
  col: { flex: 1 },
  kv: { flexDirection: "row", marginBottom: 2 },
  kvKey: {
    width: 110,
    color: MUTED,
  },
  kvVal: { flex: 1 },
  tHead: {
    flexDirection: "row",
    backgroundColor: ACCENT_RED,
    color: "#FFFFFF",
  },
  tRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderColor: BORDER,
    minHeight: 28,
  },
  tRowZebra: { backgroundColor: ZEBRA },
  th: {
    padding: 4,
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
  },
  td: {
    padding: 4,
    fontSize: 9,
  },
});
