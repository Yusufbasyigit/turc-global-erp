import { computeDiff, prettyFieldLabel, formatJsonValue } from "./diff";

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

section("computeDiff: insert returns all populated fields except stamps");
{
  const out = computeDiff(
    "insert",
    null,
    {
      id: "abc",
      amount: 100,
      currency: "USD",
      notes: null,
      empty: "",
      created_by: "user-x",
      created_time: "2026-05-05T00:00:00Z",
      edited_by: "user-x",
      edited_time: "2026-05-05T00:00:00Z",
    },
  );
  assertEq("3 fields (id, amount, currency)", out.length, 3);
  assertEq("alphabetical order", out.map((e) => e.field), ["amount", "currency", "id"]);
  assertEq("oldValue undefined for insert", out[0].oldValue, undefined);
  assertEq("newValue populated", out[0].newValue, 100);
}

section("computeDiff: delete returns all populated fields except stamps");
{
  const out = computeDiff(
    "delete",
    {
      id: "abc",
      amount: 50,
      created_by: "u",
      created_time: "t",
      edited_by: "u",
      edited_time: "t",
    },
    null,
  );
  assertEq("2 fields", out.length, 2);
  assertEq("oldValue populated", out[0].oldValue, 50);
  assertEq("newValue undefined for delete", out[0].newValue, undefined);
}

section("computeDiff: update returns only changed fields");
{
  const out = computeDiff(
    "update",
    { id: "abc", amount: 100, currency: "USD", notes: "hello" },
    { id: "abc", amount: 200, currency: "USD", notes: "hello" },
  );
  assertEq("only amount changed", out.length, 1);
  assertEq("field is amount", out[0].field, "amount");
  assertEq("oldValue", out[0].oldValue, 100);
  assertEq("newValue", out[0].newValue, 200);
}

section("computeDiff: update ignores audit-stamp columns");
{
  const out = computeDiff(
    "update",
    {
      id: "abc",
      amount: 100,
      edited_by: "user-a",
      edited_time: "2026-05-04T00:00:00Z",
    },
    {
      id: "abc",
      amount: 100,
      edited_by: "user-b",
      edited_time: "2026-05-05T00:00:00Z",
    },
  );
  assertEq("no diff when only stamps changed", out.length, 0);
}

section("computeDiff: update detects null → value transitions");
{
  const out = computeDiff("update", { notes: null }, { notes: "hello" });
  assertEq("1 entry", out.length, 1);
  assertEq("oldValue is null", out[0].oldValue, null);
  assertEq("newValue is string", out[0].newValue, "hello");
}

section("computeDiff: update detects field-removed (key gone)");
{
  const out = computeDiff(
    "update",
    { amount: 100, notes: "x" },
    { amount: 100 },
  );
  assertEq("1 entry", out.length, 1);
  assertEq("field", out[0].field, "notes");
  assertEq("oldValue", out[0].oldValue, "x");
  assertEq("newValue undefined", out[0].newValue, undefined);
}

section("computeDiff: deep-equal nested objects do not produce diff");
{
  const out = computeDiff(
    "update",
    { meta: { a: 1, b: 2 } },
    { meta: { a: 1, b: 2 } },
  );
  assertEq("no diff", out.length, 0);
}

section("computeDiff: nested object diff produces entry");
{
  const out = computeDiff(
    "update",
    { meta: { a: 1 } },
    { meta: { a: 2 } },
  );
  assertEq("1 entry", out.length, 1);
}

section("prettyFieldLabel");
{
  assertEq("snake to title", prettyFieldLabel("invoice_currency"), "Invoice currency");
  assertEq("strips _id suffix", prettyFieldLabel("contact_id"), "Contact");
  assertEq("override wins", prettyFieldLabel("hs_code"), "HS code");
  assertEq("etd_date override", prettyFieldLabel("etd_date"), "ETD");
}

section("formatJsonValue");
{
  assertEq("null shows as ∅", formatJsonValue(null), "∅");
  assertEq("undefined as em-dash", formatJsonValue(undefined), "—");
  assertEq("empty string preserved", formatJsonValue(""), '""');
  assertEq("number stringified", formatJsonValue(12.5), "12.5");
  assertEq("boolean stringified", formatJsonValue(true), "true");
  assertEq("string passthrough", formatJsonValue("hello"), "hello");
  assertEq("object json-stringified", formatJsonValue({ a: 1 }), '{"a":1}');
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
