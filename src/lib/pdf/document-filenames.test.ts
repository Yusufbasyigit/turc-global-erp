import {
  buildKdvCsvFilename,
  buildProformaPdfFilename,
  buildStatementPdfFilename,
  slugifyForFilename,
} from "./document-filenames";

let passed = 0;
let failed = 0;

function assertEq<T>(label: string, actual: T, expected: T): void {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
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

section("1. slugifyForFilename: ASCII passthrough");
{
  assertEq("simple", slugifyForFilename("Acme Co"), "Acme-Co");
}

section("2. slugifyForFilename: drops Turkish diacritics");
{
  assertEq(
    "turkish",
    slugifyForFilename("İğneada Şirketi Ticaret A.Ş."),
    "Igneada-Sirketi-Ticaret-A.S",
  );
}

section("3. slugifyForFilename: drops Spanish/French diacritics");
{
  assertEq(
    "spanish",
    slugifyForFilename("Sociedad Comercial Mediterráneo S.L."),
    "Sociedad-Comercial-Mediterraneo",
  );
}

section("4. slugifyForFilename: replaces Windows-invalid chars with -");
{
  assertEq("invalid chars", slugifyForFilename('a/b\\c:d*e?f"g<h>i|j'), "a-b-c-d-e-f-g-h-i-j");
}

section("5. slugifyForFilename: truncates and strips trailing dash");
{
  // 32 chars, with the cut landing on a dash: trailing dash trimmed.
  const slug = slugifyForFilename("Sociedad Comercial Mediterráneo S.L.", 32);
  assertEq("no trailing dash", slug.endsWith("-"), false);
}

section("6. slugifyForFilename: empty/garbage falls back to Untitled");
{
  assertEq("empty", slugifyForFilename("   "), "Untitled");
  assertEq("symbols only", slugifyForFilename("///"), "Untitled");
}

section("7. buildProformaPdfFilename: full shape");
{
  const out = buildProformaPdfFilename({
    offerNumber: "TG-2026-0042",
    customerName: "İğneada Şirketi",
    offerDate: "2026-04-28",
  });
  assertEq("filename", out, "Proforma_2026-04-28_TG-2026-0042_Igneada-Sirketi.pdf");
}

section("8. buildProformaPdfFilename: missing date is omitted");
{
  const out = buildProformaPdfFilename({
    offerNumber: "TG-2026-0042",
    customerName: "Acme Co",
    offerDate: null,
  });
  assertEq("no date segment", out, "Proforma_TG-2026-0042_Acme-Co.pdf");
}

section("9. buildProformaPdfFilename: ISO date with time gets sliced");
{
  const out = buildProformaPdfFilename({
    offerNumber: "X",
    customerName: "Y",
    offerDate: "2026-04-28T13:00:00Z",
  });
  assertEq("date sliced", out, "Proforma_2026-04-28_X_Y.pdf");
}

section("10. buildStatementPdfFilename: shape");
{
  const out = buildStatementPdfFilename({
    shipmentName: "TG-SHIP-2026-018",
    customerName: "Acme",
    etdDate: "2026-04-12",
  });
  assertEq("filename", out, "Statement_2026-04-12_TG-SHIP-2026-018_Acme.pdf");
}

section("11. buildKdvCsvFilename: includes period");
{
  assertEq(
    "filename",
    buildKdvCsvFilename("2026-04"),
    "KDV_2026-04_TurcGlobal.csv",
  );
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
