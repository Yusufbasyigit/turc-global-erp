// Shared volume/weight math for shipments and the line items inside them.
//
// Two valid ways to express a line's volume:
//   1. cbm_per_unit_snapshot in m³ (authoritative if set)
//   2. package_length_cm × package_width_cm × package_height_cm in cm,
//      with units_per_package — derived as
//      (L × W × H) / 1_000_000 / units_per_package (m³ per unit)
// (1) wins when both are present.

export type DimensionLine = {
  cbm_per_unit_snapshot?: number | string | null;
  weight_kg_per_unit_snapshot?: number | string | null;
  package_length_cm?: number | string | null;
  package_width_cm?: number | string | null;
  package_height_cm?: number | string | null;
  units_per_package?: number | string | null;
  quantity?: number | string | null;
};

const CM3_PER_M3 = 1_000_000;

function toNum(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function packageCbm(line: DimensionLine): number | null {
  const l = toNum(line.package_length_cm);
  const w = toNum(line.package_width_cm);
  const h = toNum(line.package_height_cm);
  if (l === null || w === null || h === null) return null;
  if (l === 0 || w === 0 || h === 0) return null;
  return (l * w * h) / CM3_PER_M3;
}

// Per-unit CBM, deriving from package dims + units_per_package when the
// explicit snapshot is missing.
export function effectiveCbmPerUnit(line: DimensionLine): number | null {
  const explicit = toNum(line.cbm_per_unit_snapshot);
  if (explicit !== null && explicit > 0) return explicit;
  const pkg = packageCbm(line);
  const upp = toNum(line.units_per_package);
  if (pkg === null || upp === null || upp <= 0) return null;
  return pkg / upp;
}

// CBM derived from package dims alone (used as a UI hint to show what
// the volume *would* be if cbm_per_unit is left blank).
export function derivedCbmPerUnit(line: DimensionLine): number | null {
  const pkg = packageCbm(line);
  const upp = toNum(line.units_per_package);
  if (pkg === null || upp === null || upp <= 0) return null;
  return pkg / upp;
}

export type LineTotals = {
  cbm: number;
  weightKg: number;
  // True when this line contributes 0 because no usable dimensions exist.
  missingDimensions: boolean;
  missingWeight: boolean;
};

export function lineTotals(line: DimensionLine): LineTotals {
  const qty = toNum(line.quantity) ?? 0;
  const perUnitCbm = effectiveCbmPerUnit(line);
  const perUnitKg = toNum(line.weight_kg_per_unit_snapshot);
  return {
    cbm: perUnitCbm !== null ? perUnitCbm * qty : 0,
    weightKg: perUnitKg !== null ? perUnitKg * qty : 0,
    missingDimensions: perUnitCbm === null && qty > 0,
    missingWeight: perUnitKg === null && qty > 0,
  };
}

export type ShipmentTotals = {
  cbm: number;
  weightKg: number;
  lineCount: number;
  linesMissingDimensions: number;
  linesMissingWeight: number;
};

export function aggregateShipmentTotals(
  orders: Array<{ order_details: DimensionLine[] | null | undefined } | null>,
): ShipmentTotals {
  let cbm = 0;
  let weightKg = 0;
  let lineCount = 0;
  let missingDims = 0;
  let missingWt = 0;
  for (const o of orders) {
    for (const d of o?.order_details ?? []) {
      const t = lineTotals(d);
      cbm += t.cbm;
      weightKg += t.weightKg;
      lineCount += 1;
      if (t.missingDimensions) missingDims += 1;
      if (t.missingWeight) missingWt += 1;
    }
  }
  return {
    cbm,
    weightKg,
    lineCount,
    linesMissingDimensions: missingDims,
    linesMissingWeight: missingWt,
  };
}

// Standard shipping container capacities. Numbers are nominal *internal*
// loadable volume and payload weight — typical industry references for
// dry containers and 40' high-cube reefers. Real-world fill is ~85% of
// these because of pallet voids, but we keep the nominal numbers and
// surface a separate "practical" threshold via PRACTICAL_LOAD_FACTOR.
export type ContainerType = "20DC" | "40DC" | "40HC" | "40RF";

export const CONTAINER_CAPACITY: Record<
  ContainerType,
  { label: string; cbm: number; payloadKg: number }
> = {
  "20DC": { label: "20' dry", cbm: 33.2, payloadKg: 28200 },
  "40DC": { label: "40' dry", cbm: 67.7, payloadKg: 28800 },
  "40HC": { label: "40' high cube", cbm: 76.4, payloadKg: 28600 },
  "40RF": { label: "40' reefer", cbm: 67.0, payloadKg: 27000 },
};

export const PRACTICAL_LOAD_FACTOR = 0.85;

export function isKnownContainer(type: string | null): type is ContainerType {
  return type !== null && type in CONTAINER_CAPACITY;
}

export type ContainerFill = {
  container: ContainerType;
  capacity: { cbm: number; payloadKg: number };
  fill: { cbm: number; weightKg: number }; // 0..1+
  overCbm: boolean;
  overWeight: boolean;
  // Soft-warning thresholds — over the practical load factor but still
  // under the nominal max.
  tightCbm: boolean;
  tightWeight: boolean;
};

export function containerFillSummary(
  container: ContainerType,
  totals: { cbm: number; weightKg: number },
): ContainerFill {
  const cap = CONTAINER_CAPACITY[container];
  const cbmFill = cap.cbm > 0 ? totals.cbm / cap.cbm : 0;
  const weightFill = cap.payloadKg > 0 ? totals.weightKg / cap.payloadKg : 0;
  return {
    container,
    capacity: { cbm: cap.cbm, payloadKg: cap.payloadKg },
    fill: { cbm: cbmFill, weightKg: weightFill },
    overCbm: cbmFill > 1,
    overWeight: weightFill > 1,
    tightCbm: cbmFill > PRACTICAL_LOAD_FACTOR && cbmFill <= 1,
    tightWeight:
      weightFill > PRACTICAL_LOAD_FACTOR && weightFill <= 1,
  };
}
