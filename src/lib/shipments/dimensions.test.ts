import {
  packageCbm,
  effectiveCbmPerUnit,
  derivedCbmPerUnit,
  lineTotals,
  aggregateShipmentTotals,
  containerFillSummary,
  isKnownContainer,
  CONTAINER_CAPACITY,
  PRACTICAL_LOAD_FACTOR,
  type DimensionLine,
} from "./dimensions";

let passed = 0;
let failed = 0;

function approx(a: number, b: number, eps = 0.0001): boolean {
  return Math.abs(a - b) < eps;
}

function assertEq<T>(label: string, actual: T, expected: T): void {
  const ok =
    typeof actual === "number" && typeof expected === "number"
      ? approx(actual, expected)
      : JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    passed += 1;
    console.log(`  ✓ ${label}`);
  } else {
    failed += 1;
    console.log(
      `  ✗ ${label}\n    expected: ${JSON.stringify(expected)}\n    actual:   ${JSON.stringify(actual)}`,
    );
  }
}

function section(title: string): void {
  console.log(`\n${title}`);
}

function line(opts: Partial<DimensionLine>): DimensionLine {
  return {
    cbm_per_unit_snapshot: null,
    weight_kg_per_unit_snapshot: null,
    package_length_cm: null,
    package_width_cm: null,
    package_height_cm: null,
    units_per_package: null,
    quantity: null,
    ...opts,
  };
}

section("1. packageCbm: 100×100×100 cm = 1 m³");
{
  assertEq(
    "1 m^3",
    packageCbm(line({ package_length_cm: 100, package_width_cm: 100, package_height_cm: 100 })),
    1,
  );
}

section("2. packageCbm: any dim missing -> null");
{
  assertEq(
    "missing height",
    packageCbm(line({ package_length_cm: 100, package_width_cm: 100, package_height_cm: null })),
    null,
  );
  assertEq(
    "missing length",
    packageCbm(line({ package_length_cm: null, package_width_cm: 100, package_height_cm: 100 })),
    null,
  );
}

section("3. packageCbm: any dim zero -> null (not 0 m³)");
{
  // Zero in a dim means 'unspecified' here, not literal flat package.
  assertEq(
    "zero length",
    packageCbm(line({ package_length_cm: 0, package_width_cm: 100, package_height_cm: 100 })),
    null,
  );
}

section("4. packageCbm: numeric strings (Postgres numeric -> string)");
{
  const v = packageCbm(line({
    package_length_cm: "50" as unknown as number,
    package_width_cm: "50" as unknown as number,
    package_height_cm: "50" as unknown as number,
  }));
  assertEq("0.125 m^3", v, 0.125);
}

section("5. packageCbm: negative numbers rejected as null");
{
  assertEq(
    "negative",
    packageCbm(line({ package_length_cm: -1, package_width_cm: 100, package_height_cm: 100 })),
    null,
  );
}

section("6. effectiveCbmPerUnit: explicit snapshot wins when > 0");
{
  const v = effectiveCbmPerUnit(line({
    cbm_per_unit_snapshot: 0.05,
    package_length_cm: 100,
    package_width_cm: 100,
    package_height_cm: 100,
    units_per_package: 10,
  }));
  assertEq("uses snapshot, not derived", v, 0.05);
}

section("7. effectiveCbmPerUnit: zero snapshot falls back to derived");
{
  // Spec: "explicit !== null && explicit > 0" — so 0 falls through.
  const v = effectiveCbmPerUnit(line({
    cbm_per_unit_snapshot: 0,
    package_length_cm: 100,
    package_width_cm: 100,
    package_height_cm: 100,
    units_per_package: 10,
  }));
  assertEq("falls back from 0 snapshot", v, 0.1);
}

section("8. effectiveCbmPerUnit: null snapshot derives from package + upp");
{
  const v = effectiveCbmPerUnit(line({
    cbm_per_unit_snapshot: null,
    package_length_cm: 100,
    package_width_cm: 100,
    package_height_cm: 100,
    units_per_package: 4,
  }));
  assertEq("1 m^3 / 4", v, 0.25);
}

section("9. effectiveCbmPerUnit: missing dims and missing snapshot -> null");
{
  const v = effectiveCbmPerUnit(line({ cbm_per_unit_snapshot: null }));
  assertEq("null", v, null);
}

section("10. effectiveCbmPerUnit: units_per_package zero -> null (no div by 0)");
{
  const v = effectiveCbmPerUnit(line({
    cbm_per_unit_snapshot: null,
    package_length_cm: 100,
    package_width_cm: 100,
    package_height_cm: 100,
    units_per_package: 0,
  }));
  assertEq("null", v, null);
}

section("11. derivedCbmPerUnit: same as effective when no snapshot");
{
  const l = line({
    package_length_cm: 100,
    package_width_cm: 100,
    package_height_cm: 100,
    units_per_package: 5,
  });
  assertEq("derived", derivedCbmPerUnit(l), 0.2);
}

section("12. derivedCbmPerUnit: ignores snapshot (UI hint only)");
{
  const l = line({
    cbm_per_unit_snapshot: 99, // ignored by derivedCbmPerUnit
    package_length_cm: 100,
    package_width_cm: 100,
    package_height_cm: 100,
    units_per_package: 5,
  });
  assertEq("derived ignores snapshot", derivedCbmPerUnit(l), 0.2);
}

section("13. lineTotals: cbm and weight scale by quantity");
{
  const t = lineTotals(line({
    cbm_per_unit_snapshot: 0.1,
    weight_kg_per_unit_snapshot: 5,
    quantity: 10,
  }));
  assertEq("cbm", t.cbm, 1);
  assertEq("weight", t.weightKg, 50);
  assertEq("not missing dims", t.missingDimensions, false);
  assertEq("not missing wt", t.missingWeight, false);
}

section("14. lineTotals: missing dims flagged when qty > 0");
{
  const t = lineTotals(line({ quantity: 5 }));
  assertEq("cbm 0", t.cbm, 0);
  assertEq("weight 0", t.weightKg, 0);
  assertEq("missing dims flagged", t.missingDimensions, true);
  assertEq("missing wt flagged", t.missingWeight, true);
}

section("15. lineTotals: qty=0 -> not flagged as missing (no contribution expected)");
{
  const t = lineTotals(line({ quantity: 0 }));
  assertEq("missing dims not flagged", t.missingDimensions, false);
  assertEq("missing wt not flagged", t.missingWeight, false);
}

section("16. lineTotals: null quantity coerced to 0");
{
  const t = lineTotals(line({ cbm_per_unit_snapshot: 1, weight_kg_per_unit_snapshot: 1 }));
  assertEq("cbm 0", t.cbm, 0);
  assertEq("weight 0", t.weightKg, 0);
}

section("17. aggregateShipmentTotals: sums across orders, counts missing");
{
  const result = aggregateShipmentTotals([
    {
      order_details: [
        line({ cbm_per_unit_snapshot: 0.1, weight_kg_per_unit_snapshot: 5, quantity: 10 }),
        line({ quantity: 3 }), // missing
      ],
    },
    {
      order_details: [
        line({ cbm_per_unit_snapshot: 0.05, weight_kg_per_unit_snapshot: 2, quantity: 4 }),
      ],
    },
  ]);
  assertEq("cbm sum", result.cbm, 0.1 * 10 + 0 + 0.05 * 4);
  assertEq("weight sum", result.weightKg, 5 * 10 + 0 + 2 * 4);
  assertEq("line count", result.lineCount, 3);
  assertEq("missing dims", result.linesMissingDimensions, 1);
  assertEq("missing wt", result.linesMissingWeight, 1);
}

section("18. aggregateShipmentTotals: handles null orders + null details");
{
  const result = aggregateShipmentTotals([null, { order_details: null }]);
  assertEq("cbm 0", result.cbm, 0);
  assertEq("line count 0", result.lineCount, 0);
}

section("19. isKnownContainer: known + unknown");
{
  assertEq("20DC", isKnownContainer("20DC"), true);
  assertEq("40HC", isKnownContainer("40HC"), true);
  assertEq("unknown", isKnownContainer("XYZ"), false);
  assertEq("null", isKnownContainer(null), false);
}

section("20. containerFillSummary: under capacity -> not over, not tight");
{
  const fill = containerFillSummary("40DC", { cbm: 30, weightKg: 10000 });
  assertEq("not over cbm", fill.overCbm, false);
  assertEq("not over wt", fill.overWeight, false);
  assertEq("not tight cbm", fill.tightCbm, false);
  assertEq("not tight wt", fill.tightWeight, false);
}

section("21. containerFillSummary: over 100% capacity flags over*");
{
  const cap = CONTAINER_CAPACITY["20DC"];
  const fill = containerFillSummary("20DC", {
    cbm: cap.cbm + 1,
    weightKg: cap.payloadKg + 1,
  });
  assertEq("over cbm", fill.overCbm, true);
  assertEq("over wt", fill.overWeight, true);
  // When over 100%, tight is *not* set (tight is only the soft warn band).
  assertEq("not tight when over", fill.tightCbm, false);
  assertEq("not tight wt when over", fill.tightWeight, false);
}

section("22. containerFillSummary: between practical and 100% -> tight, not over");
{
  const cap = CONTAINER_CAPACITY["40HC"];
  const targetCbm = cap.cbm * (PRACTICAL_LOAD_FACTOR + 0.05); // ~90%
  const targetKg = cap.payloadKg * (PRACTICAL_LOAD_FACTOR + 0.05);
  const fill = containerFillSummary("40HC", { cbm: targetCbm, weightKg: targetKg });
  assertEq("tight cbm", fill.tightCbm, true);
  assertEq("tight wt", fill.tightWeight, true);
  assertEq("not over cbm", fill.overCbm, false);
  assertEq("not over wt", fill.overWeight, false);
}

section("23. containerFillSummary: fill ratios computed correctly");
{
  const cap = CONTAINER_CAPACITY["20DC"];
  const fill = containerFillSummary("20DC", { cbm: cap.cbm / 2, weightKg: cap.payloadKg / 4 });
  assertEq("cbm fill 0.5", fill.fill.cbm, 0.5);
  assertEq("wt fill 0.25", fill.fill.weightKg, 0.25);
}

section("24. product fallback: line snapshots null, product carries dims");
{
  const v = effectiveCbmPerUnit({
    cbm_per_unit_snapshot: null,
    package_length_cm: null,
    package_width_cm: null,
    package_height_cm: null,
    units_per_package: null,
    quantity: 100,
    product: {
      package_length_cm: 60,
      package_width_cm: 40,
      package_height_cm: 50,
      units_per_package: 1000,
    },
  });
  // (60×40×50) / 1_000_000 / 1000 = 0.00012 m³/unit
  assertEq("derives from product", v, 0.00012);
}

section("25. product fallback: line snapshot wins over product (override semantic)");
{
  const v = effectiveCbmPerUnit({
    cbm_per_unit_snapshot: 0.5, // explicit override
    package_length_cm: null,
    package_width_cm: null,
    package_height_cm: null,
    units_per_package: null,
    product: {
      cbm_per_unit: 0.001, // ignored
      package_length_cm: 60,
      package_width_cm: 40,
      package_height_cm: 50,
      units_per_package: 1000,
    },
  });
  assertEq("snapshot wins", v, 0.5);
}

section("26. product fallback: package dims fall through per-field");
{
  // Line has length, product has width/height/upp — fields combine.
  const v = effectiveCbmPerUnit({
    package_length_cm: 100,
    package_width_cm: null,
    package_height_cm: null,
    units_per_package: null,
    product: {
      package_width_cm: 50,
      package_height_cm: 50,
      units_per_package: 10,
    },
  });
  // (100×50×50) / 1_000_000 / 10 = 0.025
  assertEq("per-field merge", v, 0.025);
}

section("27. lineTotals: missingDimensions=false when product fills the gap");
{
  const t = lineTotals({
    quantity: 100,
    cbm_per_unit_snapshot: null,
    package_length_cm: null,
    package_width_cm: null,
    package_height_cm: null,
    units_per_package: null,
    weight_kg_per_unit_snapshot: null,
    product: {
      cbm_per_unit: 0.01,
      weight_kg_per_unit: 2,
    },
  });
  assertEq("cbm via product", t.cbm, 1);
  assertEq("weight via product", t.weightKg, 200);
  assertEq("not missing dims", t.missingDimensions, false);
  assertEq("not missing weight", t.missingWeight, false);
}

section("28. weight fallback: snapshot wins, falls back to product");
{
  const withSnap = lineTotals({
    quantity: 10,
    weight_kg_per_unit_snapshot: 7,
    product: { weight_kg_per_unit: 99 },
  });
  assertEq("snapshot weight wins", withSnap.weightKg, 70);

  const fallback = lineTotals({
    quantity: 10,
    weight_kg_per_unit_snapshot: null,
    product: { weight_kg_per_unit: 3 },
  });
  assertEq("falls back to product weight", fallback.weightKg, 30);
}

section("29. aggregateShipmentTotals: product fallback works in aggregate");
{
  const result = aggregateShipmentTotals([
    {
      order_details: [
        // Stale line (pre-dim product), product now has dims
        {
          quantity: 35000,
          cbm_per_unit_snapshot: null,
          package_length_cm: null,
          package_width_cm: null,
          package_height_cm: null,
          units_per_package: null,
          weight_kg_per_unit_snapshot: null,
          product: {
            package_length_cm: 60,
            package_width_cm: 40,
            package_height_cm: 50,
            units_per_package: 1000,
          },
        },
      ],
    },
  ]);
  // 35000 × (60·40·50/1_000_000)/1000 = 35000 × 0.00012 = 4.2 m³
  assertEq("aggregate cbm via product", result.cbm, 4.2);
  assertEq("not flagged as missing", result.linesMissingDimensions, 0);
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
