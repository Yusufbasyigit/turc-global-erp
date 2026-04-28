# Turc Global ERP — End-to-end scenario report

**Run date:** 2026-04-28
**Scope:** Three real business scenarios driven through the live UI of the dev environment (no separate test DB available — all rows namespaced `TEST — *`).
**Mandate:** Find pain points; do not fix them.

---

## Headline findings (read this first)

1. **Profit & Loss does not surface revenue from booked shipments** (and apparently never has — the trailing-12-month chart is flat zero across the board). After Scenario A booked a shipment that wrote a `+21,000 USD` shipment_billing into the customer ledger, `/profit-loss` for April 2026 still showed `$0.00 Revenue / $0.00 Expense / $0.00 Net P&L`. This is the single biggest gap in the run — month-end reporting is structurally unable to tie out.
2. **The `/transactions` list is empty for all filters even when transactions exist.** Three transactions recorded successfully (toast confirmed, contact ledger updated, contact balance correct) — list view kept showing "No transactions yet. Record your first transaction." Either a stale cache or the default filter excludes the kinds the page is supposed to display.
3. **No FX gain/loss capture path.** When same-currency (USD → USD account) payments are recorded, the form shows no FX rate field. The "frozen FX rate" mechanism only activates when transaction currency ≠ account currency. For an export company billing in USD and receiving in USD, the entire FX delta against TRY books is invisible. The decisions.md log treats this as out of scope, but it surfaces immediately in real workflows.
4. **Real estate brokerage isn't modeled.** No property entity, no owner, no commission field, no fiduciary/pass-through concept. A deal is just `us ↔ counterparty + schedule`. Brokering on behalf of a network owner requires the operator to invent the structure outside the app.
5. **No bank reconciliation, no AR/AP aging, no trial balance, no balance sheet, no period close.** Confirmed absent — and per `decisions.md` (2026-04-25, 2026-04-27) most are deliberately deferred. The app cannot perform a real month-end close on its own.

---

## Scenario A — Export sale to Africa (Lagos)

**What I drove through the UI:**

| Step | Action | Result |
|---|---|---|
| 1 | Created customer `TEST — Lagos Trading Ltd` (Customer, USD, Nigeria) | ✓ saved (after a re-open glitch — see UX #1) |
| 2 | Created order in USD: 500 × Olive Oil 5L @ $42 = $21,000 | ✓ saved as Inquiry |
| 3 | Filled proforma details (Incoterm, payment terms) and advanced to Quoted | ✓ — proforma TG-20260427-001 generated |
| 4 | Generated proforma PDF | ✓ toast: "Proforma TG-20260427-001 generated." |
| 5 | Advanced order to Accepted | ✓ |
| 6 | Recorded 30% prepayment ($6,300, dated 2026-04-01, USD → USD) | ✓ in contact ledger; **NOT in /transactions list** |
| 7 | Created shipment, set 20HC + 1,800 USD freight + ETD/ETA, booked it | ✓ — toast: "Invoice for 21,000.00 USD written to customer ledger." |
| 8 | Recorded final 70% payment ($14,700, dated 2026-04-22, USD → USD) | ✓ in ledger; ledger NET BALANCE = 0.00 USD ("settled") |
| 9 | Tried to record FX gain (Other income, TRY 20,790) | First attempt rejected (currency mismatch); second attempt with explicit currency=TRY → ✓ |

**Things that broke or required workarounds:**

### UX issues

1. **Add-contact dialog state leak.** Filling step 1 of the contact wizard, advancing through, and triggering "Add contact" again did not open a fresh form — it returned to the prior in-progress state on step 4. Fresh dialogs should reset.
2. **Country picker required two clicks** to register a value the first time — clicking the combobox then clicking the option used `eval` JS click, which Radix didn't always pick up. Using `preview_click` on the option's id worked.
3. **Order line form has no currency hint.** The line items section (qty / unit_sales_price / est_purchase) shows no currency code. The operator has to trust that the customer's `balance_currency` (set elsewhere) carries through.
4. **Proforma details don't auto-save before "Advance to Quoted".** I changed Incoterm to CIF Lagos and payment terms to 50/50, clicked "Advance to Quoted" — the form silently reverted to defaults. There's a separate "Save proforma details" button further down the panel that must be clicked first; the workflow conflates these steps.
5. **Payment terms preset list is closed.** Options are exactly: Cash payment / Net 30 / 50% advance, 50% on delivery / 100% advance. The scenario called for 30% / 70% — there is no way to express it on the proforma. I used 50/50 as the closest match. For a Turkish exporter where partial advance percentages vary per customer, this list will be limiting.
6. **No expense type for "Customs / Duties".** Closest is "Operations & Logistics". For a Turkish export business, customs is a frequent and large line — it should be its own type so KDV reports and P&L can isolate it.
7. **No way to link a payment to an order from the order page.** From the order detail screen there is no "Record payment" button. The operator must navigate to /transactions, pick "Money in → Client payment", manually re-pick the customer, and (importantly) cannot tag the payment with `related_order_id` from the UI even though the data model supports it. The link only exists in the description text.
8. **Other income / Other expense have no contact field.** The FX gain workaround couldn't be associated with the Lagos customer except via reference text. There's no FK to the order or to the customer.
9. **Shipment "freight cost" is single-line.** The scenario asks for "freight in USD AND customs in TRY". The shipment dialog has exactly one freight cost field (with one currency). Customs has to be recorded separately via the Transactions module as an Expense, with no link back to the shipment.
10. **Other income form silently defaults currency to USD.** I picked a TRY account but the currency field stayed USD — submission failed with "Account currency (TRY) does not match transaction currency (USD)". The currency field should follow the chosen account, or at least flash a warning at the time of account selection rather than at submit.

### Data integrity issues

1. **`/transactions` list shows "No transactions yet"** despite three transactions just recorded and confirmed by toast. After full reload, still empty. Default filter must be excluding `client_payment` / `other_income` (or all kinds), or the page is querying wrong. The contact ledger and shipment billing summary update correctly, so the writes are persisted — only this view is broken.
2. **Shipment "PAID (FIFO ACROSS LEDGER)" shows 0.00 USD** even though the customer had $6,300 of unallocated prepayment when the shipment was booked. The contact ledger correctly nets to zero after the final $14,700 payment, but the shipment-level paid number does not reflect FIFO allocation. The label says "FIFO across ledger" so it should — this is a UI/computation mismatch. (Outstanding column on the shipment correctly says $21,000 then settles, but it implies "no payments applied" which is misleading.)
3. **Contact ledger shows "UNALLOCATED CREDIT 21,000.00 USD"** even after billing arrived and cleared everything. The math (Total Billed 21k = Total Paid 21k = Net 0) is right, but "unallocated credit" should drop to 0 once FIFO consumes the prepayments against the new billing.
4. **Bamako Distribution Sarl appears as a duplicate row** in the contacts table — same company name, contact, phone, email, currency. Could be a real duplicate contact (data) or a UI render bug. Either way it's user-visible.
5. **Order status and shipment status diverge.** After booking the shipment, the order auto-jumped to "Shipped" but the shipment was still "Draft" until I explicitly advanced it. They should track in lockstep, or the order should be blocked from advancing past the underlying shipment.

### "I had to leave the app" moments

1. **FX gain/loss must be calculated in Excel.** The system captures no TRY-equivalent value at billing time when the invoice is in USD, and no FX rate at payment time when the account is also in USD. To know that we earned ~20,790 TRY on the Lagos deal, I had to multiply each USD payment by an out-of-band rate manually. Reproducing this in the books required a manual `other_income` entry in TRY that has no link to the originating order or to the customer ledger.
2. **PDF proforma had to be downloaded then mailed externally.** The system generated the proforma PDF (good), but there is no mail-merge / send-to-customer flow inside the app. The user would attach it to an email outside.
3. **Customs declaration / tracking docs.** No data model for storing customs declaration numbers, BL numbers, COO documents in a structured way — only generic file attachments. For Turkish customs filings these typically need to be cross-referenced.

---

## Scenario B — Real estate brokerage

**What I drove through the UI:**

| Step | Action | Result |
|---|---|---|
| 1 | Created tenant contact `TEST — Maslak Tenant LLC` (Real Estate type) | ✓ saved |
| 2 | Opened "New deal" dialog on /real-estate | dialog opened |
| 3 | Filled label, examined the schema | confirmed gaps below |

I did not complete the deal because the design gaps surfaced are the actual finding — running the workflow further would not reveal anything new. The scenario as written cannot be supported by the current data model.

### Capability gaps confirmed

1. **No property entity.** A "deal" is identified only by a free-text `Label` (placeholder "e.g. Şişli daire kira"). There's no `properties` table, no address, no owner FK, no rentable-units concept. Two deals on the same physical property cannot be aggregated.
2. **No owner / fiduciary concept.** The deal has one counterparty (the tenant or buyer). For a brokerage scenario where Turc Global collects rent on behalf of an external owner, there is no field for who that owner is, nor for the pass-through obligation.
3. **No commission percentage / split.** A brokerage that earns 10% of rent has no way to express that. The deal's full `expected_amount` becomes Turc Global's revenue. To show only commission as revenue, the operator would have to (a) reduce the installment amounts to 10% of actual rent — which loses the audit trail of what the tenant actually paid — or (b) record the full rent as revenue and offset 90% as an expense pass-through (which decisions.md says journal entries are deferred for).
4. **No revenue recognition timing.** Cash-basis only — recognized at `client_payment`. For a sale where the deed transfer happens in May but the buyer pays in April, there's no way to defer / accrue the revenue.

### "I had to leave the app" moments

1. **WhatsApp / Excel for owner remittance.** When Turc Global collects 100,000 TRY of rent and owes 90,000 TRY to the owner, the owner-payable side is invisible. The operator would track it on a side spreadsheet and pay the owner via a separate `Money out → Expense` transaction with no link back to the deal.
2. **Property inventory / pipeline lives outside the app.** No place to list properties currently being marketed, rented out, or sold — those would all sit in WhatsApp threads or a Sheets doc.
3. **Commission contracts.** No way to attach the brokerage commission agreement PDF to the deal — only generic attachments on transactions.

---

## Scenario C — Month-end close

**What I checked:**

- `/profit-loss` for April 2026 → screenshot below
- Looked for: bank reconciliation UI, AR/AP aging, trial balance, balance sheet, "close period" button, accruals UI
- KDV (Turkish VAT) summary — tracked elsewhere per decisions.md (2026-04-26)

### What's there

- **Income statement (P&L)**: page exists at `/profit-loss`. Rate display "1 USD = 45.00 TRY · source: snapshot · Apr 28, 2026" with override capability. Trailing 12-month chart. Revenue / Expense / Net P&L cards.

### What isn't there

- **Bank reconciliation** — no statement import, no `cleared` flag on transactions, no reconciliation worksheet. **Confirmed absent.**
- **AR/AP aging report** — no aging buckets (0-30 / 30-60 / 60-90 / 90+). **Confirmed absent.** The contact ledger gives running balances per contact, but no aged view across all customers.
- **Accruals** — no journal entry feature (decisions.md 2026-04-27 confirms this is deferred). Cannot record an accrual for April expenses paid in May.
- **Closing entries / period lock** — no concept. Any past-month transaction can be edited or deleted at any time.
- **Trial balance** — no GL accounts table, no TB report. **Confirmed absent.**
- **Balance sheet** — no BS report. **Confirmed absent.**

### The blocking issue surfaced this run

**The P&L for April 2026 showed `$0.00 Revenue / $0.00 Expense / $0.00 Net P&L`** even though Scenario A had just booked a `+21,000 USD` shipment_billing into the contact ledger for the Lagos deal *that same month*, plus a $20,790 TRY `other_income` (FX gain workaround). Reload did not change the result.

The trailing-12-month chart was also flat zero across all 12 months, suggesting this isn't a date-filter issue — the P&L is structurally not picking up the kinds of transactions that landed. Per the earlier code exploration, P&L should include `shipment_billing`, `order_billing`, `other_income` as revenue and `expense`, `other_expense`, `shipment_cogs`, `shipment_freight` as expense — but none of the historical Bamako/Mali test orders' billings were appearing either, so the picture is consistent: revenue from booked shipments is not flowing into the P&L view. This means a real month-end produces a P&L that says $0 — completely unusable.

(I did not have time to diagnose root cause — the user instruction was "do not fix, log".)

### Three statements tie-out

Cannot be performed. Only an income statement view exists, and it isn't producing values. Trial balance and balance sheet are not implemented.

### "I had to leave the app" moments

The entire close. Concretely:
- Bank statement → reconciliation: would be done in Excel.
- Aged receivables: would be re-derived in Sheets from a CSV export of contact ledgers.
- Accruals: handled in a memo ledger outside the app.
- Trial balance / BS: not produced. The accountant would build them from a CSV of all transactions.
- Tax filing: KDV summary exists, but the actual filing happens on Turkey's online tax portal.

---

## Cleanup list (TEST rows to delete)

The following rows were created during this run and should be removed when convenient:

| Table | Identifier | Notes |
|---|---|---|
| `contacts` | `TEST — Lagos Trading Ltd` | Customer, USD, Nigeria |
| `contacts` | `TEST — Maslak Tenant LLC` | Real Estate type |
| `orders` | `b51fd167` (TG-20260427-001) | Status: Shipped, $21,000 |
| `shipments` | `TEST — Lagos #1 — Apr 2026` | Status: Booked |
| `transactions` | client_payment, $6,300, 2026-04-01, ref `PI TG-20260427-001` | Lagos prepayment |
| `transactions` | client_payment, $14,700, 2026-04-22, ref `PI TG-20260427-001 — final 70%` | Lagos final |
| `transactions` | other_income, 20,790 TRY, 2026-04-22, ref `FX gain — TG-20260427-001` | FX gain workaround |
| `transactions` | shipment_billing, $21,000, 2026-04-27 (auto-created at shipment booking) | Booking will need to be undone first |

Suggested SQL pattern (run from Supabase Studio):
```sql
-- Inspect first
select id, kind, amount, currency, transaction_date, description
from transactions
where description ilike '%TEST%' or reference_number ilike '%TG-20260427%';

-- Delete in dependency order: transactions → shipments → orders → contacts
```

The order's auto-generated `shipment_billing` transaction is linked to the shipment (`related_shipment_id`), so deleting the shipment will likely cascade — verify before deleting.

---

## Key screenshots

The following key screens were captured during the run (saved in the preview tool's session, not embedded here):

1. Order detail showing Accepted status with auto-generated proforma TG-20260427-001 ✓
2. Shipment detail showing `Billed 21,000.00 USD ✓ on Apr 27, 2026` with `PAID 0.00 USD` (the FIFO bug) ✓
3. Contact ledger showing all three movements ending at NET BALANCE 0.00 USD "settled" ✓
4. `/transactions` showing "No transactions yet" despite three transactions in the DB ✗
5. `/profit-loss` April 2026 showing $0 across the board ✗

The contact-ledger text capture (the most important piece of evidence) reads:

```
NET BALANCE       0.00 USD            settled
TOTAL BILLED      21,000.00 USD
TOTAL PAID        21,000.00 USD
UNALLOCATED CREDIT 21,000.00 USD       ← misleading; should be 0

DATE         EVENT             REFERENCE                                AMOUNT          RUNNING BALANCE
Apr 01, 2026 Client payment    PI TG-20260427-001                       -6,300.00 USD   -6,300.00 USD
Apr 22, 2026 Client payment    PI TG-20260427-001 — final 70%           -14,700.00 USD  -21,000.00 USD
Apr 27, 2026 Shipment billing  TEST — Lagos #1 — Apr 2026               +21,000.00 USD       0.00 USD
```

---

## Priority for follow-up session

If asked to triage these into "fix vs. accept as design", my read is:

**Bugs worth investigating first (likely fixable in hours):**
1. P&L showing $0 (probably a query / filter bug; revenue is in the DB)
2. `/transactions` list always empty (likely the same class of issue)
3. `UNALLOCATED CREDIT` not zeroing out after FIFO match
4. Shipment `PAID (FIFO across ledger)` not surfacing prepayments
5. Bamako duplicate contact row
6. Other income form defaulting currency to USD instead of following the chosen account
7. Order status auto-advancing to Shipped when shipment is still Draft
8. Add-contact dialog state leak when re-opened mid-flow

**Friction worth fixing as scope (days, not hours):**
9. `Customs / Duties` as its own expense type
10. Custom payment terms percentage on proforma (e.g. 30/70)
11. "Record payment" button on order detail that pre-fills customer + currency + related_order_id
12. Contact field on Other income / Other expense
13. Multi-line freight + customs on shipment, both with their own currency

**Genuine design decisions (per decisions.md, deliberately deferred):**
14. FX gain/loss as a first-class concept
15. Bank reconciliation
16. AR/AP aging report
17. Real estate property + owner + commission split
18. Accruals / journal entries
19. Period close / lock
20. Trial balance / balance sheet

The first eight are the ones that block real workflows today. The next five are the "operator quality of life" gap. The rest are larger product calls.
