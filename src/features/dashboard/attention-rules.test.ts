import {
  kdvUnfiledRule,
  oldPartnerReimbursementRule,
  shipmentEtaPastDueRule,
} from "./attention-rules";
import type { ShipmentListRow } from "@/features/shipments/queries";
import type { KdvMonth } from "@/lib/ledger/kdv-summary";
import type { PartnerPendingSummary } from "@/features/partners/queries/pending-reimbursements";

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

function shipment(
  id: string,
  status: ShipmentListRow["status"],
  eta_date: string | null,
  name: string = `SHP-${id}`,
): ShipmentListRow {
  return {
    id,
    name,
    status,
    eta_date,
  } as ShipmentListRow;
}

function kdv(
  period: string,
  status: KdvMonth["status"],
  net_try: number = 1000,
): KdvMonth {
  return {
    period,
    collected_vat_try: 0,
    paid_vat_try: 0,
    net_try,
    status,
    linked_payment_id: null,
    linked_payment_reference: null,
    skipped_count: 0,
  };
}

function partner(
  id: string,
  name: string,
  buckets: Array<{
    currency: string;
    amount: number;
    claim_count: number;
    oldest_open_claim_date: string | null;
    oldest_open_claim_amount: number;
  }>,
): PartnerPendingSummary {
  return {
    partner: { id, name },
    pending: buckets,
  };
}

// =============================================================================
section("Rule 1 — shipment in transit past ETA");
// =============================================================================

const TODAY = "2026-04-25";

{
  const items = shipmentEtaPastDueRule(
    [shipment("s1", "in_transit", "2026-04-20")],
    TODAY,
  );
  assertEq("in_transit + past eta -> 1 item", items.length, 1);
  assertEq("severity is red", items[0].severity, "red");
  assertEq("href is /shipments/s1", items[0].href, "/shipments/s1");
  assertEq("id is stable", items[0].id, "shipment-eta-s1");
  assertEq("entity is shipment name", items[0].entity, "SHP-s1");
  assertEq("age says 5 days late", items[0].age, "5 days late");
}

{
  const items = shipmentEtaPastDueRule(
    [shipment("s1", "in_transit", TODAY)],
    TODAY,
  );
  assertEq("in_transit + eta == today -> 0 items", items.length, 0);
}

{
  const items = shipmentEtaPastDueRule(
    [shipment("s1", "in_transit", "2026-05-10")],
    TODAY,
  );
  assertEq("in_transit + future eta -> 0 items", items.length, 0);
}

{
  const items = shipmentEtaPastDueRule(
    [shipment("s1", "arrived", "2026-04-01")],
    TODAY,
  );
  assertEq("arrived + past eta -> 0 items", items.length, 0);
}

{
  const items = shipmentEtaPastDueRule(
    [shipment("s1", "in_transit", null)],
    TODAY,
  );
  assertEq("in_transit + null eta -> 0 items", items.length, 0);
}

{
  const items = shipmentEtaPastDueRule(
    [shipment("s1", "draft", "2026-04-01")],
    TODAY,
  );
  assertEq("draft + past eta -> 0 items", items.length, 0);
}

// =============================================================================
section("Rule 2 — KDV unfiled past 26th of M+1");
// =============================================================================

// 2026-04-25 — March's deadline (2026-04-26) is tomorrow, NOT past.
const NOW_PRE_MARCH_DEADLINE = new Date("2026-04-25T12:00:00Z");
// 2026-04-27 — March's deadline (2026-04-26) is now in the past.
const NOW_POST_MARCH_DEADLINE = new Date("2026-04-27T12:00:00Z");

{
  const items = kdvUnfiledRule(
    [kdv("2026-03", "unfiled")],
    NOW_PRE_MARCH_DEADLINE,
  );
  assertEq(
    "2026-03 unfiled, today=2026-04-25 (deadline 2026-04-26) -> 0 items",
    items.length,
    0,
  );
}

{
  const items = kdvUnfiledRule(
    [kdv("2026-03", "unfiled")],
    NOW_POST_MARCH_DEADLINE,
  );
  assertEq(
    "2026-03 unfiled, today=2026-04-27 -> 1 item",
    items.length,
    1,
  );
  assertEq("severity is red", items[0].severity, "red");
  assertEq("entity is period", items[0].entity, "2026-03");
  assertEq("href is /tax", items[0].href, "/tax");
  assertEq("age says 1 day past Beyanname", items[0].age, "1 day past Beyanname");
}

{
  const items = kdvUnfiledRule(
    [kdv("2026-03", "filed")],
    NOW_POST_MARCH_DEADLINE,
  );
  assertEq("2026-03 filed -> 0 items", items.length, 0);
}

{
  // 2026-04 is the current period — never flagged regardless of state.
  const items = kdvUnfiledRule(
    [kdv("2026-04", "unfiled")],
    NOW_POST_MARCH_DEADLINE,
  );
  assertEq("current period (2026-04) -> 0 items", items.length, 0);
}

{
  // Net VAT zero -> nothing to file, no flag.
  const items = kdvUnfiledRule(
    [kdv("2026-02", "unfiled", 0)],
    NOW_POST_MARCH_DEADLINE,
  );
  assertEq("net_try == 0 -> 0 items", items.length, 0);
}

{
  // Negative net VAT (refund situation) still flags.
  const items = kdvUnfiledRule(
    [kdv("2026-02", "unfiled", -500)],
    NOW_POST_MARCH_DEADLINE,
  );
  assertEq("negative net_try still flags", items.length, 1);
}

{
  const items = kdvUnfiledRule(
    [
      kdv("2026-04", "unfiled"),
      kdv("2026-03", "unfiled"),
      kdv("2026-02", "filed"),
      kdv("2026-01", "unfiled"),
    ],
    NOW_POST_MARCH_DEADLINE,
  );
  assertEq("2 unfiled past deadline (2026-03, 2026-01)", items.length, 2);
}

// =============================================================================
section("Rule 3 — old partner reimbursement (>30d)");
// =============================================================================

{
  const items = oldPartnerReimbursementRule(
    [
      partner("p1", "Partner One", [
        {
          currency: "USD",
          amount: 500,
          claim_count: 1,
          oldest_open_claim_date: "2026-03-20",
          oldest_open_claim_amount: 500,
        },
      ]),
    ],
    TODAY,
  );
  assertEq("36-day-old USD claim -> 1 item", items.length, 1);
  assertEq("severity is amber", items[0].severity, "amber");
  assertEq("href is /partners", items[0].href, "/partners");
  assertEq(
    "entity includes partner name",
    items[0].entity.includes("Partner One"),
    true,
  );
  assertEq("age says 36 days old", items[0].age, "36 days old");
}

{
  const items = oldPartnerReimbursementRule(
    [
      partner("p1", "Partner One", [
        {
          currency: "USD",
          amount: 100,
          claim_count: 1,
          oldest_open_claim_date: "2026-04-20",
          oldest_open_claim_amount: 100,
        },
      ]),
    ],
    TODAY,
  );
  assertEq("5-day-old claim -> 0 items", items.length, 0);
}

{
  const items = oldPartnerReimbursementRule(
    [partner("p1", "Partner One", [])],
    TODAY,
  );
  assertEq("no pending buckets -> 0 items", items.length, 0);
}

{
  // Two buckets, both >30d. Pick the older one.
  const items = oldPartnerReimbursementRule(
    [
      partner("p1", "Partner One", [
        {
          currency: "EUR",
          amount: 200,
          claim_count: 1,
          oldest_open_claim_date: "2026-03-10",
          oldest_open_claim_amount: 200,
        },
        {
          currency: "USD",
          amount: 100,
          claim_count: 1,
          oldest_open_claim_date: "2026-02-15",
          oldest_open_claim_amount: 100,
        },
      ]),
    ],
    TODAY,
  );
  assertEq("two old buckets -> 1 item per partner", items.length, 1);
  assertEq(
    "picks older (USD/2026-02-15)",
    items[0].entity.includes("USD") || items[0].entity.includes("$"),
    true,
  );
}

{
  // One bucket >30d, one bucket <30d. Should still emit one item using the old one.
  const items = oldPartnerReimbursementRule(
    [
      partner("p1", "Partner One", [
        {
          currency: "EUR",
          amount: 200,
          claim_count: 1,
          oldest_open_claim_date: "2026-04-22",
          oldest_open_claim_amount: 200,
        },
        {
          currency: "USD",
          amount: 100,
          claim_count: 1,
          oldest_open_claim_date: "2026-02-15",
          oldest_open_claim_amount: 100,
        },
      ]),
    ],
    TODAY,
  );
  assertEq("mixed-age buckets -> 1 item", items.length, 1);
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
