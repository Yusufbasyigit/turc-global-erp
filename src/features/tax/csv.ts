import {
  VAT_COLLECTED_KINDS,
  VAT_PAID_KINDS,
} from "@/lib/ledger/kdv-summary";
import { istanbulYearMonth } from "@/lib/proforma/istanbul-date";
import type { KdvRow } from "./queries";

function escapeCell(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function rowsToCsv(
  headers: string[],
  rows: (string | number | null)[][],
): string {
  return [headers, ...rows]
    .map((r) => r.map(escapeCell).join(","))
    .join("\r\n");
}

const VAT_BEARING = new Set<string>([
  ...VAT_COLLECTED_KINDS,
  ...VAT_PAID_KINDS,
]);

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

  const headers = [
    "date",
    "kind",
    "counterparty",
    "reference_number",
    "description",
    "currency",
    "net_amount",
    "vat_rate",
    "vat_amount",
  ];

  const body: (string | number | null)[][] = [];
  const noteCols: (string | number | null)[] = new Array(headers.length).fill("");
  noteCols[0] = `# KDV ${period} — non-TRY rows omitted: ${skipped}`;
  body.push(noteCols);

  for (const r of tryRows) {
    body.push([
      r.transaction_date,
      r.kind,
      r.contact_name ?? r.partner_name ?? "",
      r.reference_number ?? "",
      r.description ?? "",
      r.currency,
      r.net_amount ?? "",
      r.vat_rate ?? "",
      r.vat_amount ?? "",
    ]);
  }

  return {
    csv: rowsToCsv(headers, body),
    tryCount: tryRows.length,
    skippedCount: skipped,
  };
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
