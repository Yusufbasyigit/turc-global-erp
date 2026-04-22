# Decisions log

Non-obvious decisions made during design. Each entry: what, why,
alternatives considered, date. Newest at the top.


## 2026-04-22 — Dev auth bypass environment switch
**What:** `NEXT_PUBLIC_DISABLE_AUTH=true` in `.env.local` short-circuits the auth middleware and stamps `created_by`/`edited_by` as null. Lives in `src/lib/auth-mode.ts`. Must remain unset in production.
**Why:** Speeds up local development — no need to sign in every hot reload. The null audit stamping makes dev-mode writes visually obvious in the DB.
**Alternatives:** Seed a test user and always log in — rejected, more friction day-to-day.

## 2026-04-22 — Soft delete for contacts via `deleted_at`
**What:** Deleting a contact sets `deleted_at = now()` rather than removing the row. Every list query filters `.is("deleted_at", null)`.
**Why:** Deleted contacts may still be referenced by historical transactions/orders. Hard delete would orphan FK references.
**Alternatives:** Hard delete with FK cascade — rejected, destroys audit trail.

## 2026-04-22 — Balance currency constrained in code to TRY/EUR/USD/GBP
**What:** The TypeScript type in `src/lib/supabase/types.ts` narrows balance_currency to these four values, even though the DB column likely accepts any text.
**Why:** Matches actual business use. Prevents typos like "USD " or "Usd" creating silent bugs.
**Alternatives:** Lock at the DB level with a CHECK constraint — better, but can be added later without schema pain.

## 2026-04-22 — "No country" bucket in country-grouped view
**What:** Contacts with null country_code group under a `__none` bucket labelled "No country" with a 🏳 emoji.
**Why:** Grouping must not silently drop rows. Explicit bucket surfaces missing data so Yusuf notices and fixes it.

## 2026-04-22 — Both floating + header "Add contact" buttons on desktop
**What:** Desktop shows both a header "Add contact" button and a floating + button bottom-right. Mobile shows only the floating button.
**Why:** Header button is discoverable for new users; floating button is fast for power use.
**Alternatives:** Pick one — deferred. Revisit if it feels cluttered in practice.

## 2026-04-21 — Unified accounts: one table for every asset type
**What:** The `accounts` table holds fiat bank balances, crypto, physical metals, and fund positions — rows tagged by `asset_type` (fiat | crypto | metal | fund). Old `currency` column renamed `asset_code` since it now holds BTC, Altın, KTJ, etc., not just currencies.
**Why:** Treasury.md's "quantity is the source of truth" principle applies equally to grams of gold and units of KTJ as it does to dollars. Splitting into per-asset-class tables would duplicate schema for the same pattern.
**Alternatives:** Separate `bank_accounts`, `crypto_holdings`, `fund_positions` tables — rejected, same shape repeated three times.

## 2026-04-21 — Table name stays `accounts`, not renamed to `holdings`
**What:** Keep `accounts` as the table name even though treasury.md's sketch calls it "Holdings."
**Why:** Many V1 references (transactions.from_account_id, to_account_id) already point at `accounts`. Renaming would cascade through the codebase for cosmetic gain.

## 2026-04-21 — Custody location as editable lookup (Şirket / Ortak / Kasa + off-site)
**What:** New `custody_locations` table (id, name, location_type: bank | physical). Accounts link to it via `custody_location_id`. List is editable in the app — Yusuf can add GAP 1/4, Kasa Çekme, etc. without a migration.
**Why:** Treasury.md requires custody to be a first-class dimension independent of asset type. Editability avoids schema changes every time a new safe or off-site location is added.

## 2026-04-21 — Price snapshots unified across asset types
**What:** Single `price_snapshots` table (asset_code, snapshot_date, price, price_currency, source). V1's `fund_prices` migrated in and dropped.
**Why:** Gold, crypto, and fund prices all have the same shape — a daily price in some currency with a source. One table keeps the display logic uniform.

## 2026-04-21 — FX snapshots separate from price snapshots
**What:** `fx_snapshots(currency_code, snapshot_date, rate_to_usd, source, fetched_at)`. Written only when the user taps the FX refresh button (per treasury.md — no background refresh).
**Why:** FX has two distinct jobs (wallet display vs. frozen client-balance rate) and a different refresh cadence than asset prices. Combining them would conflate "price of an asset" with "value of a currency against USD."

## 2026-04-21 — Ortak movement type deferred to accounting module
**What:** The partner-loan vs. profit-share distinction on Ortak transactions is not modelled yet. Will be added to the `transactions` table when the accounting module is designed.
**Why:** Mainstream ERPs handle this via GL account codes, not transaction flags. That design belongs to accounting, not treasury.
---

## 2026-04-21 — Contact types: customer, supplier, logistics, other
**What:** Contact `type` constrained to these four values. Government dropped. Partners live in their own table, not in contacts.
**Why:** Mainstream ERPs don't treat governments as contacts — tax offices are registries referenced in filings, not transactable parties. Partners have their own data shape (ownership %, profit-share) and their own UI section.
**Alternatives:** Keep Government (rejected — no transactions attach to it). Fold Partners into contacts (rejected — different fields, already separate in the app).

## 2026-04-21 — Single type per contact
**What:** One contact has exactly one type. A company that is both supplier and customer is duplicated.
**Why:** Has never happened in Yusuf's practice. Multi-role modelling would cost UI and schema complexity for a non-problem.
**Alternatives:** Multi-role via array or join table — rejected.

## 2026-04-21 — Country as controlled ISO list
**What:** `contacts.country_code` references a `countries` lookup table keyed by ISO-3166-1 alpha-2 codes (TR, ML, CM…). Lookup holds display name and flag.
**Why:** Free text breaks country-grouped views and flag rendering (Türkiye / Turkey / TR become three groups).
**Alternatives:** Free text (rejected).

## 2026-04-21 — Tax ID stored on all contacts; Tax Office Turkish-only in UI
**What:** `tax_id` is a field on every contact, required for customers (needed in Yükleme Talimatı), optional otherwise. `tax_office` is stored on every contact but only shown in forms when country = Türkiye.
**Why:** Yükleme Talimatı requires client tax ID regardless of country. Vergi Dairesi (tax office) is a Turkish tax concept only — showing it for foreign contacts clutters the form.
**Alternatives:** Tax ID only for Turkish contacts (rejected — foreign customers need it too for shipping docs).

## 2026-04-21 — Contact notes split: static field + timestamped activity log
**What:** Each contact has a `notes` text field for persistent facts, plus a separate `contact_notes` table for timestamped interaction entries. Activity entries are append-only.
**Why:** Static context ("pays late") and dated incidents ("21 Apr disagreement") are different needs. Mixing them loses the date anchor on incidents.
**Alternatives:** Single notes field with hand-typed dates (rejected — unstructured, not queryable).

## 2026-04-21 — Packaging defaults on the product, overridable per order
**What:** Each product has a usual packaging config. When added to an order line, that config copies over and can be edited for that specific order without touching the product master.
**Why:** Most products always ship the same way (tiles on 120×80 pallets, etc.), so a default covers nearly all cases. Occasional one-offs (break a pallet into loose boxes) need to be captured without polluting the product master.
**Alternatives:** (a) packaging only on product — too rigid; (b) only on order line — repetitive entry; (c) only on shipment — too late, proposal needs it.

## 2026-04-21 — Product versioning: snapshot at order time (Option A)
**What:** `products` table holds only the current state. When a product is added to an order line, relevant fields (name, price, description, photo, packaging) are copied onto the line. Editing a product later doesn't retroactively change old orders.
**Why:** Old orders must stay faithful to what was sold. Snapshotting keeps schema simple (one row per product) while preserving historical truth.
**Alternatives:** Option B — version rows per material edit, order lines reference a specific version. Heavier schema, allows a product-history view. Rejected because per-order fidelity matters, product-side history doesn't.

## 2026-04-21 — Inquiry is the first status of an order, not a separate entity
**What:** An order can exist from the inquiry stage with minimal fields (client + product). It progresses: inquiry → quoted → accepted → in production → shipped → done.
**Why:** Avoids two near-identical entities and a "promote inquiry to order" step. Same row, earlier state.

## 2026-04-21 — Client balance tracked per client, not per order
**What:** One running balance per client. Payments and order charges flow against it. No per-order balance.
**Why:** Clients pre-load funds to build up for future orders ($30k sent when only $10k of orders exist). Per-order balance would be over-engineered for this pattern.

## 2026-04-21 — Client balance currency fixed per client
**What:** Each client has a default currency. Their balance is always kept in that currency. Payments in other currencies convert at receipt-time rate.
**Why:** One consistent view of what the client has paid and what's owed. Avoids multi-currency-per-client mess.

## 2026-04-21 — Payment FX rate captured at transaction time
**What:** When a payment arrives, the FX rate used to convert it into the client's balance currency is stored on the transaction row and never recomputed.
**Why:** A client-balance credit is a promise made on a specific date. It must not silently move when rates change. Distinct from treasury wallet display, where FX is applied at display time from snapshots.

## 2026-04-21 — Freight is a separate line, not allocated into per-product profit
**What:** Orders are sold EXW. Freight is quoted and invoiced as its own line, not amortised back into product margins.
**Why:** Matches how Yusuf already sells. Keeps per-product profit clean.

## 2026-04-21 — Orders sit inside shipments; shipping the shipment ships all orders inside
**What:** A shipment groups one or more orders. Order status is per order, but when the shipment ships, every order inside transitions together.
**Why:** One container often carries multiple consolidated orders. Status must cascade from the shipment event.

---

## Decisions already in treasury.md (cross-referenced for completeness)

- Gold sub-locations (GAP 1/4, Kasa Çekme) treated as physical custody locations; location list editable in the app.
- Zekat feature out of MVP scope.
- Spot price API choice deferred to build time.
- Stale FX UX: grey out USD column when rates > 24h old (threshold tunable).
- Ortak transactions must record movement type (partner loan vs. profit-share) for correct GL posting later.
