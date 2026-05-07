import {
  VAT_COLLECTED_KINDS,
  VAT_PAID_KINDS,
} from "@/lib/ledger/kdv-summary";
import { istanbulYearMonth, todayIsoDate } from "@/lib/proforma/istanbul-date";
import type { KdvRow } from "./queries";

// Turkish-locale Excel parses CSVs with `;` as the default separator. Keeping
// `,` here would force the recipient to run Text-to-Columns every time.
// Numeric values in this CSV never contain semicolons, so the switch is
// safe; cells containing `;`, `"` or newlines are still escaped via RFC 4180
// quoting.
const SEPARATOR = ";";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function escapeCell(v: unknown, separator: string = SEPARATOR): string {
  const s = v == null ? "" : String(v);
  // Escape if the cell contains the separator, a quote, or a newline.
  // The `# ` comment-style is no longer used, but keeping the regex
  // tolerant of leading whitespace is cheap insurance against future
  // header injections.
  const re = new RegExp(`["${separator.replace(/[\\/]/g, "\\$&")}\\n\\r]`);
  return re.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function rowsToCsv(
  headers: string[],
  rows: (string | number | null)[][],
  separator: string = SEPARATOR,
): string {
  return [headers, ...rows]
    .map((r) => r.map((c) => escapeCell(c, separator)).join(separator))
    .join("\r\n");
}

const VAT_BEARING = new Set<string>([
  ...VAT_COLLECTED_KINDS,
  ...VAT_PAID_KINDS,
]);

// Display labels for transaction kinds. Human-readable in the CSV, but only
// the kinds that can actually appear after the VAT_BEARING filter — others
// are omitted intentionally so a bug surfaces as "kind: <slug>" rather than
// being silently mistranslated.
const KIND_LABELS: Record<string, string> = {
  shipment_billing: "Sevkiyat faturalama",
  other_income: "Diğer gelir",
  supplier_invoice: "Tedarikçi faturası",
  expense: "Gider",
};

const COLLECTED = new Set<string>(VAT_COLLECTED_KINDS);

function vatDirection(kind: string): "collected" | "paid" | "" {
  if (COLLECTED.has(kind)) return "collected";
  if (VAT_BEARING.has(kind)) return "paid";
  return "";
}

export function buildKdvCsv(rows: KdvRow[], period: string): {
  csv: string;
  tryCount: number;
  skippedCount: number;
} {
  const inMonth = rows.filter(
    (r) =>
      VAT_BEARING.has(r.kind) &&
      istanbulYearMonth(r.transaction_date) === period,
  );
  const tryRows = inMonth.filter((r) => r.currency === "TRY" && r.vat_amount != null);
  const skipped = inMonth.length - tryRows.length;

  // Aggregate collected vs. paid totals for the footer summary. Doing this
  // in JS rather than Excel formulas keeps the export self-contained and
  // means the recipient can paste rows around without breaking links.
  let collectedNetRaw = 0;
  let collectedVatRaw = 0;
  let paidNetRaw = 0;
  let paidVatRaw = 0;
  for (const r of tryRows) {
    const dir = vatDirection(r.kind);
    const net = Number(r.net_amount ?? 0);
    const vat = Number(r.vat_amount ?? 0);
    if (dir === "collected") {
      collectedNetRaw += net;
      collectedVatRaw += vat;
    } else if (dir === "paid") {
      paidNetRaw += net;
      paidVatRaw += vat;
    }
  }
  // Round each footer figure to two decimals so IEEE-754 drift from
  // accumulated additions never leaks into the BEYAN form.
  const collectedNet = round2(collectedNetRaw);
  const collectedVat = round2(collectedVatRaw);
  const paidNet = round2(paidNetRaw);
  const paidVat = round2(paidVatRaw);
  const netVatPayable = round2(collectedVat - paidVat);

  const headers = [
    "Tarih",
    "İşlem türü",
    "Yön",
    "Karşı taraf",
    "Belge no",
    "Açıklama",
    "Para birimi",
    "Matrah (Net)",
    "KDV oranı",
    "KDV tutarı",
  ];

  const lines: string[] = [];

  // Header block — metadata about the export. Each row is a single labelled
  // cell so Excel renders it as a clean two-column block rather than the
  // old single-comment-cell-with-N-trailing-empties shape.
  lines.push(`KDV Beyannamesi;${period}`);
  lines.push(`Dönem;${period}`);
  lines.push(`Hazırlanma tarihi;${todayIsoDate()}`);
  lines.push(`İşlenen satır;${tryRows.length}`);
  lines.push(`Atlanan satır (TRY dışı veya KDV yok);${skipped}`);
  lines.push("");
  lines.push(headers.map((h) => escapeCell(h)).join(SEPARATOR));

  for (const r of tryRows) {
    lines.push(
      [
        r.transaction_date,
        KIND_LABELS[r.kind] ?? r.kind,
        vatDirection(r.kind) === "collected" ? "Tahsil edilen" : "Ödenen",
        r.contact_name ?? r.partner_name ?? "",
        r.reference_number ?? "",
        r.description ?? "",
        r.currency,
        r.net_amount ?? "",
        r.vat_rate ?? "",
        r.vat_amount ?? "",
      ]
        .map((c) => escapeCell(c))
        .join(SEPARATOR),
    );
  }

  // Footer totals — three pinned rows the accountant can paste straight
  // into the BEYAN form.
  lines.push("");
  lines.push(
    [
      "Toplam tahsil edilen KDV",
      "",
      "",
      "",
      "",
      "",
      "TRY",
      collectedNet || "",
      "",
      collectedVat || "",
    ]
      .map((c) => escapeCell(c))
      .join(SEPARATOR),
  );
  lines.push(
    [
      "Toplam ödenen KDV",
      "",
      "",
      "",
      "",
      "",
      "TRY",
      paidNet || "",
      "",
      paidVat || "",
    ]
      .map((c) => escapeCell(c))
      .join(SEPARATOR),
  );
  lines.push(
    [
      "Net ödenecek / devreden KDV",
      "",
      "",
      "",
      "",
      "",
      "TRY",
      "",
      "",
      netVatPayable || "",
    ]
      .map((c) => escapeCell(c))
      .join(SEPARATOR),
  );

  return {
    csv: lines.join("\r\n"),
    tryCount: tryRows.length,
    skippedCount: skipped,
  };
}

export function downloadCsv(filename: string, csv: string): void {
  // UTF-8 BOM (﻿). Required for Excel-TR to autodetect UTF-8;
  // without it, Turkish characters render as mojibake on first open.
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
