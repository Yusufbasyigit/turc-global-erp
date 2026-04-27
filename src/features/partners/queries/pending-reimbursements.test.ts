import {
  buildPendingSummary,
  type ClaimOrPayoutRow,
} from "./pending-reimbursements";

let passed = 0;
let failed = 0;

function approx(a: number, b: number, eps = 0.001): boolean {
  return Math.abs(a - b) < eps;
}

function assertEq<T>(label: string, actual: T, expected: T): void {
  const ok =
    typeof actual === "number" && typeof expected === "number"
      ? approx(actual, expected)
      : JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    passed += 1;
    console.log(`  \u2713 ${label}`);
  } else {
    failed += 1;
    console.log(
      `  \u2717 ${label}\n    expected: ${JSON.stringify(expected)}\n    actual:   ${JSON.stringify(actual)}`,
    );
  }
}

function claim(
  id: string,
  partnerId: string,
  date: string,
  amount: number,
  currency: string,
): ClaimOrPayoutRow {
  return {
    id,
    kind: "expense",
    partner_id: partnerId,
    from_account_id: null,
    transaction_date: date,
    amount,
    currency,
    description: null,
    is_loan: false,
  };
}

function payout(
  id: string,
  partnerId: string,
  date: string,
  amount: number,
  currency: string,
): ClaimOrPayoutRow {
  return {
    id,
    kind: "partner_loan_out",
    partner_id: partnerId,
    from_account_id: null,
    transaction_date: date,
    amount,
    currency,
    description: null,
    is_loan: false,
  };
}

function section(title: string): void {
  console.log(`\n${title}`);
}

const partners = [
  { id: "p1", name: "Partner One" },
  { id: "p2", name: "Partner Two" },
  { id: "p3", name: "Partner Three" },
];

section("0. No partners, no rows -> empty");
{
  const r = buildPendingSummary([], []);
  assertEq("length", r.length, 0);
}

section("0b. Partners exist, no rows -> empty (nothing pending)");
{
  const r = buildPendingSummary(partners, []);
  assertEq("length", r.length, 0);
}

section("0c. Claims fully settled -> partner omitted");
{
  const r = buildPendingSummary(
    [partners[0]],
    [
      claim("c1", "p1", "2026-01-01", 100, "USD"),
      payout("po1", "p1", "2026-01-10", 100, "USD"),
    ],
  );
  assertEq("length", r.length, 0);
}

section("1. One partner with one pending currency");
{
  const r = buildPendingSummary(
    [partners[0]],
    [
      claim("c1", "p1", "2026-01-01", 500, "USD"),
      claim("c2", "p1", "2026-02-01", 300, "USD"),
      payout("po1", "p1", "2026-03-01", 600, "USD"),
    ],
  );
  assertEq("one partner", r.length, 1);
  assertEq("partner id", r[0].partner.id, "p1");
  assertEq("one currency", r[0].pending.length, 1);
  assertEq("currency", r[0].pending[0].currency, "USD");
  assertEq("outstanding amount", r[0].pending[0].amount, 200);
  assertEq("one open claim", r[0].pending[0].claim_count, 1);
}

section("2. One partner with multiple pending currencies");
{
  const r = buildPendingSummary(
    [partners[0]],
    [
      claim("c1", "p1", "2026-01-01", 500, "USD"),
      claim("c2", "p1", "2026-01-05", 300, "EUR"),
      claim("c3", "p1", "2026-01-10", 10000, "TRY"),
    ],
  );
  assertEq("one partner", r.length, 1);
  assertEq("three currencies", r[0].pending.length, 3);
  const byCcy = Object.fromEntries(
    r[0].pending.map((p) => [p.currency, p.amount]),
  );
  assertEq("USD pending", byCcy.USD, 500);
  assertEq("EUR pending", byCcy.EUR, 300);
  assertEq("TRY pending", byCcy.TRY, 10000);
}

section("3. Multiple partners with pending reimbursements");
{
  const r = buildPendingSummary(partners, [
    claim("c1", "p1", "2026-01-01", 500, "USD"),
    claim("c2", "p2", "2026-01-05", 300, "EUR"),
    claim("c3", "p3", "2026-01-10", 100, "USD"),
    payout("po1", "p3", "2026-01-15", 100, "USD"),
  ]);
  assertEq("two partners with pending (p3 fully settled)", r.length, 2);
  const ids = r.map((x) => x.partner.id).sort();
  assertEq("partners present", ids, ["p1", "p2"]);
}

section("4. Company-paid expense is NOT a claim (from_account_id set)");
{
  const rows: ClaimOrPayoutRow[] = [
    {
      id: "e1",
      kind: "expense",
      partner_id: "p1",
      from_account_id: "acc-1",
      transaction_date: "2026-01-01",
      amount: 500,
      currency: "USD",
      description: null,
      is_loan: false,
    },
  ];
  const r = buildPendingSummary([partners[0]], rows);
  assertEq("length", r.length, 0);
}

section("5. Rows with null partner_id are ignored");
{
  const r = buildPendingSummary(
    [partners[0]],
    [
      {
        id: "e1",
        kind: "expense",
        partner_id: null,
        from_account_id: null,
        transaction_date: "2026-01-01",
        amount: 500,
        currency: "USD",
        description: null,
        is_loan: false,
      },
    ],
  );
  assertEq("length", r.length, 0);
}

section("6. Multi-currency independence per partner");
{
  const r = buildPendingSummary(
    [partners[0]],
    [
      claim("c1", "p1", "2026-01-01", 500, "USD"),
      claim("c2", "p1", "2026-01-05", 300, "EUR"),
      payout("po1", "p1", "2026-02-01", 500, "USD"),
    ],
  );
  assertEq("one partner", r.length, 1);
  assertEq("only EUR left", r[0].pending.length, 1);
  assertEq("currency", r[0].pending[0].currency, "EUR");
  assertEq("amount", r[0].pending[0].amount, 300);
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
