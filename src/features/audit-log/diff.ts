import type { Json } from "@/types/database";

export type AuditAction = "insert" | "update" | "delete";

export type DiffEntry = {
  field: string;
  oldValue: Json | undefined;
  newValue: Json | undefined;
};

const AUDIT_STAMP_COLUMNS = new Set([
  "created_by",
  "created_time",
  "edited_by",
  "edited_time",
]);

function isJsonObject(v: Json | null | undefined): v is { [k: string]: Json } {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function jsonEqual(a: Json | undefined, b: Json | undefined): boolean {
  if (a === b) return true;
  if (a === null || b === null) return a === b;
  if (typeof a !== typeof b) return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    return JSON.stringify(a) === JSON.stringify(b);
  }
  if (typeof a === "object" && typeof b === "object") {
    return JSON.stringify(a) === JSON.stringify(b);
  }
  return a === b;
}

export function computeDiff(
  action: AuditAction,
  oldData: Json | null,
  newData: Json | null,
): DiffEntry[] {
  const oldObj = isJsonObject(oldData) ? oldData : {};
  const newObj = isJsonObject(newData) ? newData : {};

  if (action === "insert") {
    return Object.keys(newObj)
      .filter((k) => !AUDIT_STAMP_COLUMNS.has(k))
      .filter((k) => newObj[k] !== null && newObj[k] !== "")
      .sort()
      .map((k) => ({ field: k, oldValue: undefined, newValue: newObj[k] }));
  }

  if (action === "delete") {
    return Object.keys(oldObj)
      .filter((k) => !AUDIT_STAMP_COLUMNS.has(k))
      .filter((k) => oldObj[k] !== null && oldObj[k] !== "")
      .sort()
      .map((k) => ({ field: k, oldValue: oldObj[k], newValue: undefined }));
  }

  const fieldSet = new Set<string>([
    ...Object.keys(oldObj),
    ...Object.keys(newObj),
  ]);
  const entries: DiffEntry[] = [];
  for (const field of fieldSet) {
    if (AUDIT_STAMP_COLUMNS.has(field)) continue;
    const o = oldObj[field];
    const n = newObj[field];
    if (jsonEqual(o, n)) continue;
    entries.push({ field, oldValue: o, newValue: n });
  }
  entries.sort((a, b) => a.field.localeCompare(b.field));
  return entries;
}

const FIELD_LABEL_OVERRIDES: Record<string, string> = {
  hs_code: "HS code",
  cbm_per_unit: "CBM per unit",
  weight_kg_per_unit: "Weight (kg) per unit",
  fx_rate_applied: "FX rate applied",
  rate_to_usd: "Rate to USD",
  kdv_rate: "KDV rate",
  etd_date: "ETD",
  eta_date: "ETA",
  psd_event_id: "PSD event",
  url: "URL",
};

export function prettyFieldLabel(field: string): string {
  if (FIELD_LABEL_OVERRIDES[field]) return FIELD_LABEL_OVERRIDES[field];
  return field
    .replace(/_id$/, "")
    .replace(/_/g, " ")
    .replace(/^./, (c) => c.toUpperCase());
}

export function formatJsonValue(value: Json | undefined): string {
  if (value === undefined) return "—";
  if (value === null) return "∅";
  if (typeof value === "string") {
    if (value === "") return '""';
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value);
}
