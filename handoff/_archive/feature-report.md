# Turc Global ERP — Comprehensive Feature Report

A single-tenant, dark-mode-only Next.js 16 app for a Turkish trading company that combines finance and logistics. Built on Supabase Postgres, TanStack Query, React Hook Form + Zod, Tailwind v4 + shadcn/ui, and `@react-pdf/renderer`. This report inventories every module, page, table, and the connections between them.

---

## 1. Application Shell & Auth

| Layer | File | Role |
|---|---|---|
| Root layout | `src/app/layout.tsx` | Fonts (Geist, Instrument Serif, Inter, IBM Plex Mono), forces `dark`, mounts `<Providers>` |
| Providers | `src/components/providers.tsx` | TanStack Query client + Sonner toaster |
| Middleware | `src/proxy.ts` | Gates routes via Supabase session; bypassed by `NEXT_PUBLIC_DISABLE_AUTH=true` |
| Login | `src/app/login/page.tsx` + `src/components/login-form.tsx` | Magic-link sign-in |
| Auth callback | `src/app/auth/callback/route.ts` | Exchanges code for session, redirects to `?next=` |
| Sign-out | `src/app/auth/signout/route.ts` | Clears session |
| App shell | `src/app/(app)/layout.tsx` | Session check + `<AppSidebar>` + `<EditorialTopbar>` |
| Sidebar | `src/components/app-sidebar.tsx` | Two groups (Operations, Finance) + Settings footer |
| Topbar | `src/components/editorial-topbar.tsx` | Page title / breadcrumb |
| Dev auth | `src/lib/auth-mode.ts` | `AUTH_DISABLED` toggle, fallback `DEV_USER_EMAIL` |

**Sidebar navigation tree:**
- **Operations**: Contacts · Products · Orders · Shipments
- **Finance**: Treasury · Profit & Loss · Transactions · Accounts · Partners · Tax
- **Footer**: Settings

---

## 2. Routes (under `/(app)/`)

| Route | Page file | What it surfaces |
|---|---|---|
| `/dashboard` | `src/app/(app)/dashboard/page.tsx` | Editorial KPI landing (books, KDV, trend, attention list) |
| `/treasury` | `src/app/(app)/treasury/page.tsx` | Quantity-based holdings; FX refresh; movement entry |
| `/accounts` | `src/app/(app)/accounts/page.tsx` | Chart of accounts registry (active / inactive / deleted) |
| `/contacts` | `src/app/(app)/contacts/page.tsx` | Contact list (card / table) |
| `/contacts/[id]` | `src/app/(app)/contacts/[id]/page.tsx` | Notes, related orders, shipments, ledger |
| `/products` | `src/app/(app)/products/page.tsx` | Product catalog |
| `/products/[id]` | `src/app/(app)/products/[id]/page.tsx` | Full product spec |
| `/orders` | `src/app/(app)/orders/page.tsx` | Orders list + filters + batch import |
| `/orders/[id]` | `src/app/(app)/orders/[id]/page.tsx` | Lines + proforma metadata + PDF |
| `/shipments` | `src/app/(app)/shipments/page.tsx` | Shipment list grouped by customer/status |
| `/shipments/[id]` | `src/app/(app)/shipments/[id]/page.tsx` | Orders, capacity, freight, docs, statement PDF |
| `/transactions` | `src/app/(app)/transactions/page.tsx` | General ledger (Wave 1 kinds enabled) |
| `/partners` | `src/app/(app)/partners/page.tsx` | Partner list + pending reimbursements |
| `/partners/[id]` | `src/app/(app)/partners/[id]/page.tsx` | Loans, distributions, PSD calendar, ledger |
| `/tax` | `src/app/(app)/tax/page.tsx` | KDV summary + CSV export |
| `/profit-loss` | `src/app/(app)/profit-loss/page.tsx` | Monthly P&L w/ FX overrides |
| `/settings` | `src/app/(app)/settings/page.tsx` | Placeholder |

---

## 3. Feature Modules (`src/features/`)

### A. Accounts — `src/features/accounts/`
Chart-of-accounts registry across asset types (fiat, crypto, metal, fund) and custody locations.
- **Queries**: `listAccountsForRegistry`, `getAccount` (joins `custody_locations`).
- **Mutations**: `create/update/deactivate/deleteAccount` — soft-delete via `deleted_at`, deactivate via `is_active`. Enforces "metals → physical custody only", "funds → subtype required", "IBAN → fiat only".
- **UI**: `accounts-index`, `accounts-table` / `accounts-card-list`, `account-form-dialog`, deactivate / delete dialogs.
- **Connects to**: `custody_locations`, used as picker source by Treasury and Transactions (`from_account_id`, `to_account_id`).

### B. Contacts — `src/features/contacts/`
Customers, suppliers, logistics, other. Customers require `tax_id`; each contact has a `balance_currency` for invoicing.
- **Queries**: `listContacts`, `getContact`, `listCountries`, `listContactNotes`.
- **Mutations**: contact CRUD + note add/delete.
- **UI**: list + detail with `contact-ledger-section` and `supplier-ledger-section`, country flags, type badges, notes drawer.
- **Connects to**: `countries`; referenced by `orders.customer_id`, `shipments.customer_id`, `transactions.contact_id`, `products.default_supplier`, `order_details.supplier_id`.

### C. Dashboard — `src/features/dashboard/`
Print-newspaper landing page composing snapshot blocks.
- **Pieces**: `editorial-masthead`, `editorial-lead`, `editorial-books`, `editorial-kdv`, `editorial-trend-chart`, `editorial-footer`, `snapshot-cards`.
- **Logic**: `attention-rules.ts` (overdue shipments, big balances, etc.), `editorial-queries.ts` aggregates from transactions + treasury_movements + fx/price snapshots.
- **Connects to**: every finance/operations module.

### D. Orders — `src/features/orders/`
Order lifecycle: inquiry → quoted → accepted → in_production → shipped → delivered (or cancelled). Lines snapshot product specs at time of entry.
- **Queries**: `listOrders`, `getOrder`, `listOrdersByCustomer` (joins customer, shipment, lines).
- **Mutations**: order CRUD, line CRUD, `assignShipment`, `updateProformaMetadata`, `cancelOrder`, batch line import (`batch-add-lines-mutations`).
- **UI**: index, detail, `order-form-dialog`, `order-line-row`, batch-import wizard, `proforma-details-section/form`, `generate-proforma-button`, `packaging-override-dialog`, `cancel-order-dialog`.
- **Helpers**: `proforma-helpers.ts`, `constants.ts`.
- **Connects to**: contacts (customer), products + product snapshots, shipments (`shipment_id` and separate `billing_shipment_id`), proforma PDF generator, transactions (`related_order_id`).

### E. Partners — `src/features/partners/`
Owners/shareholders ledger: loans, profit distributions, pending reimbursements, monthly PSD (profit-share distribution) calendar.
- **Queries**: partner list, transactions, treasury movements.
- **Mutations**: partner CRUD, `recordPartnerLoan`, `recordProfitDistribution`, `payReimbursement` (each writes a transaction + treasury_movement pair).
- **UI**: index, detail, `partner-ledger-*`, `loans-section`, `pending-reimbursements-section`, `pay-reimbursements-button`, `psd-section`, `psd-calendar-drawer`, `manage-partners-drawer`.
- **Logic**: `queries/pending-reimbursements.ts`, `psd-summary.ts`, `partner-reimbursement-summary.ts`, `partner-transactions.ts`.
- **Connects to**: transactions (`partner_id`, kinds `partner_loan_in/out/profit_distribution`), treasury_movements via the "Ortak" custody location with `ortak_movement_type`.

### F. Products — `src/features/products/`
Item master: dual names (internal vs client), pricing in two currencies, HS code, packaging, KDV rate, photo.
- **Queries / Mutations**: list/get + CRUD + `uploadProductImage` to Supabase Storage `product-photos`.
- **UI**: index (table/card), detail, multi-step wizard form dialog (per `decisions.md`), delete dialog, active badge.
- **Connects to**: `product_categories`, `contacts.default_supplier`; consumed by `order_details`.

### G. Profit & Loss — `src/features/profit-loss/`
Monthly P&L by transaction kind; FX-converts everything to USD via daily snapshots, with manual monthly overrides for client statements.
- **Queries**: transactions in window + fx_snapshots + monthly_fx_overrides.
- **Mutations**: `setMonthlyFxOverride`, `deleteMonthlyFxOverride`.
- **UI**: index, month picker, summary, table, trend chart, `rate-banner` (shows whether override or snapshot was applied).
- **Connects to**: `transactions`, `fx_snapshots`, `monthly_fx_overrides`.

### H. Shipments — `src/features/shipments/`
Physical shipment grouping orders; tracks freight, vessel/container, ETD/ETA, documents, billing statement PDF.
- **Queries**: list, get, `listShipmentsForCustomer`, `listOrdersLinkedToShipment`.
- **Mutations**: shipment CRUD, link/unlink orders, document upload/delete, `recordShipmentBilling` (writes transaction + movement), `generateStatementPdf`.
- **UI**: index, detail, `shipment-form-dialog`, `shipment-billing-card`, `shipment-billing-breakdown`, `billing-history-summary`, `shipment-capacity-card`, `payments-applied-table`, `generate-statement-button`.
- **Logic**: `billing.ts` (`computeShipmentTotal`), `documents.ts`, `constants.ts`.
- **Connects to**: contacts (customer), orders (`shipment_id`, `billing_shipment_id`), transactions (`related_shipment_id`, kind `shipment_billing`), Storage buckets `shipment-documents` + `shipment-invoices`.

### I. Tax (KDV) — `src/features/tax/`
Turkish VAT aggregation: collected on sales, paid on expenses; rolling 12-month window; CSV export.
- **Queries**: `listKdvWindow` filters transactions by `VAT_COLLECTED_KINDS` / `VAT_PAID_KINDS` / `tax_payment` and joins names.
- **UI**: `kdv-page.tsx`, `csv.ts` exporter.
- **Connects to**: `transactions` (vat_rate, vat_amount, kdv_period), shared `src/lib/ledger/kdv-summary.ts`.

### J. Transactions — `src/features/transactions/`
General ledger. Wave 1 enabled kinds: `client_payment`, `client_refund`, `expense`, `other_income`, `other_expense`, plus `partner_loan_in/out`, `profit_distribution`, `tax_payment`. Future waves unlock `order_billing`, `shipment_billing`, supplier flows.
- **Queries**: list/get + per-contact ledger.
- **Mutations**: CRUD; optionally writes a paired treasury_movement.
- **UI**: index with filters, `transaction-form-dialog`, `constants.ts` (kind labels, disabled kinds).
- **Connects to**: accounts, contacts, partners, expense_types, shipments (`related_shipment_id`), self-FK (`related_payable_id`); foundation for KDV, P&L, Dashboard, Partner ledger.

### K. Treasury — `src/features/treasury/`
Operating view of holdings. Quantity is the source of truth; USD value is computed live from FX + price snapshots.
- **Queries**: accounts with custody, all movements, `computeBalanceMap`, `latestByKey`, `listFxSnapshots`, `listPriceSnapshots`, `listCustodyLocations`.
- **Mutations**: `recordMovement`, `recordTransfer` (paired movements with shared `group_id`), `addHolding`.
- **UI**: index with grouping toggle (asset_type / custody / flat), `add-holding-dialog`, `record-movement-dialog`, refresh button.
- **Logic**: `fx-utils.ts` (staleness, USD conversion), `refresh-engine.ts` (Frankfurter for FX, price source for crypto/metals), `constants.ts`.
- **Connects to**: accounts, transactions (via `source_transaction_id` on movements); feeds Dashboard and P&L.

---

## 4. Database Schema (Supabase Postgres)

Migrations under `supabase/migrations/`, generated types in `src/types/database.ts` and aliased in `src/lib/supabase/types.ts`.

### Core accounting
- **accounts** (`custody_location_id` → custody_locations) — `is_active`, `deleted_at`, audit columns
- **custody_locations** — bank / physical / Ortak, `requires_movement_type`
- **treasury_movements** (`account_id` → accounts, optional `source_transaction_id` → transactions) — kind ∈ opening/deposit/withdraw/transfer/trade/adjustment; transfers share a `group_id`; `ortak_movement_type` for partner sub-classification
- **transactions** (FKs: `from_account_id`, `to_account_id`, `contact_id`, `partner_id`, `expense_type_id`, `related_payable_id` self-FK, `related_shipment_id`) — kind, currency, amount, vat_rate/vat_amount, fx fields, `kdv_period`, `related_order_id` (uuid, no FK)
- **expense_types** — category groups
- **fx_snapshots** — daily, with `source` and `fetched_at`
- **price_snapshots** — non-fiat assets
- **monthly_fx_overrides** — `(currency_code, period)` for client P&L
- **rate_refresh_runs** — audit log for cron / manual refreshes

### Trading
- **contacts** (`country_code` → countries) — type, balance_currency, tax_id/office, `deleted_at`
- **contact_notes** (`contact_id` → contacts)
- **countries** — code PK, names, flag emoji
- **products** (`category_id` → product_categories, `default_supplier` → contacts) — internal + client names, pricing in two currencies, packaging, kdv_rate, image, `deleted_at`
- **product_categories**
- **orders** (`customer_id` → contacts, `shipment_id` & `billing_shipment_id` → shipments) — full proforma metadata, `customer_po_file`, `proposal_pdf`, cancel fields with CHECK constraint
- **order_details** (`order_id` → orders ON DELETE CASCADE, `product_id` → products, `supplier_id` → contacts) — quantity, vat_rate, packaging overrides, product snapshots (name/description/unit/cbm/weight/photo), price fields
- **shipments** (`customer_id` → contacts) — transport_method, vessel/container, ETD/ETA, freight, status, `documents_file`, `generated_statement_pdf`

### Partners
- **partners** — name, `is_active`, `deleted_at`

Two new migrations (uncommitted) extend this: `20260425130000_accounts_lifecycle.sql` (deactivate/soft-delete columns) and `20260425140000_monthly_fx_overrides.sql` (the override table).

---

## 5. Document Generation — `src/lib/pdf/`

Both PDFs are client-side via `@react-pdf/renderer`.

**Proforma invoice** (from order detail page):
- `proforma-pdf.tsx` composes `proforma-pdf-header`, `proforma-pdf-client-offer-block`, `proforma-pdf-line-table`, `proforma-pdf-notes-block` using `proforma-pdf-styles.ts`.

**Shipment statement** (from shipment detail page):
- `shipment-statement-pdf.tsx` composes header, `shipment-statement-pdf-client-shipment-block`, line table with freight allocation, payments-applied block, footer.

**Shared**: `shared-styles.ts`, `text-encoding.ts` for non-ASCII handling.

---

## 6. Shared Libraries (`src/lib/`)

| Concern | Files |
|---|---|
| Supabase | `supabase/client.ts`, `supabase/server.ts`, `supabase/types.ts` |
| Formatting | `format-money.ts`, `format-date.ts` (parses local-day, no UTC drift), `constants.ts` (labels, bucket names, MIME whitelists) |
| Ledger logic | `ledger/kdv-summary.ts` (+test), `ledger/fifo-allocation.ts` (+test), `ledger/partner-reimbursement-allocation.ts` (+test) |
| Proforma | `proforma/schema.ts`, `proforma/istanbul-date.ts` (KDV period in TR timezone), `proforma/offer-number.ts`, `proforma/proforma-money.ts` |
| Shipments | `shipments/dimensions.ts` (CBM, weight aggregation) |
| Auth & utils | `auth-mode.ts`, `query-client.ts`, `utils.ts` (cn) |

---

## 7. Storage Buckets (Supabase Storage)

| Bucket | Used by | Path column |
|---|---|---|
| `product-photos` | Products | `products.product_image` |
| `order-attachments` | Orders | `orders.customer_po_file` |
| `transaction-attachments` | Transactions | `transactions.attachment_path` |
| `shipment-documents` | Shipments | `shipments.documents_file` |
| `shipment-invoices` | Shipments | `shipments.generated_statement_pdf` |

5 MB limit; whitelist enforced in `src/lib/constants.ts`.

---

## 8. How Modules Connect

```
                       ┌──────────────┐
                       │   Contacts   │◄──────────────────┐
                       └──────┬───────┘                   │
                              │ customer / supplier        │
              ┌───────────────┼───────────────┐            │
              ▼               ▼               ▼            │
         ┌─────────┐    ┌──────────┐    ┌───────────┐     │
         │ Orders  │───►│Shipments │    │ Products  │     │
         └────┬────┘    └────┬─────┘    └─────┬─────┘     │
              │              │                │           │
              │ lines snapshot specs          │           │
              │                               │           │
              ▼                               ▼           │
         ┌──────────────────────────────────────────┐     │
         │            Transactions  (GL)            │─────┘
         └──┬─────────┬───────────────┬─────────────┘
            │         │               │
            ▼         ▼               ▼
       ┌────────┐ ┌────────┐    ┌──────────┐
       │Accounts│ │Partners│    │ Tax/KDV  │
       └────┬───┘ └───┬────┘    └──────────┘
            │         │
            ▼         ▼
       ┌────────────────────────┐         ┌─────────────┐
       │   Treasury Movements   │◄────────│ FX / Price  │
       │   (quantity-based)     │         │  Snapshots  │
       └───────────┬────────────┘         └─────────────┘
                   │
                   ▼
            ┌──────────────┐         ┌────────────────────┐
            │   Treasury   │         │   Profit & Loss    │
            └──────┬───────┘         │ (uses FX snapshots │
                   │                 │ + monthly overrides)│
                   ▼                 └─────────┬──────────┘
            ┌──────────────────────────────────┘
            │
            ▼
       ┌──────────┐
       │Dashboard │ ← reads from everything (attention rules)
       └──────────┘
```

**Key flows:**

1. **Order → Shipment → Billing → Cash**
   - Order placed against a customer (`contacts`), gathers line items (snapshotting product specs).
   - Order linked to a shipment via `shipment_id`; financial billing can be on a different `billing_shipment_id`.
   - Shipment billing writes a transaction (`kind=shipment_billing`, with `related_shipment_id`) and a treasury movement; statement PDF generated from the result.
   - Customer payments come in as `client_payment` transactions, applied to a holding via `to_account_id`.

2. **Treasury vs Accounts**
   - Accounts is the registry (configuration); Treasury is the runtime view.
   - Balances are computed from `treasury_movements`, regardless of an account's `is_active` / `deleted_at` state — historical totals don't change when an account is retired.
   - FX snapshots feed live USD value; staleness is shown on the page; manual refresh button hits Frankfurter via `refresh-engine.ts`.

3. **Partner profit-share & reimbursements**
   - Profit allocations create `partner_loan_in/out` and `profit_distribution` transactions, paired with movements in the Ortak custody location, classified by `ortak_movement_type`.
   - "Pending reimbursements" computed in `queries/pending-reimbursements.ts` by netting profit-share movements against repayment transactions.
   - PSD calendar defines monthly split percentages.

4. **Tax (KDV)**
   - Every transaction can populate `vat_rate`, `vat_amount`, `kdv_period` (Istanbul-tz aware via `proforma/istanbul-date.ts`).
   - KDV page filters by `VAT_COLLECTED_KINDS` (sales) and `VAT_PAID_KINDS` (purchases / expenses) over a rolling window, exports CSV for filing.

5. **Profit & Loss**
   - Aggregates transactions by revenue / expense kinds per month.
   - Converts to USD using `fx_snapshots` (daily) or `monthly_fx_overrides` (per-currency-per-period rate for client statements). The override is preferred when present and surfaced via `rate-banner`.

6. **Dashboard**
   - Pulls books (revenue / expense / net) and KDV from transactions, holdings from treasury_movements + snapshots, attention items via rule engine. Editorial layout — print-newspaper metaphor described in `handoff/`.

---

## 9. Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack, React Compiler) |
| Language | TypeScript 5 (strict) |
| Styling | Tailwind v4 + shadcn/ui (Nova) |
| Database | Supabase Postgres + Storage + Auth (magic link) |
| Server state | TanStack Query v5 |
| Forms | React Hook Form v7 + Zod v4 |
| PDFs | `@react-pdf/renderer` v4 |
| Dates | date-fns v4 (Istanbul tz for KDV) |
| Icons / UX | lucide-react, Sonner, Radix primitives |
| Hosting | Vercel |

---

## 10. Status by Module

| Module | Status |
|---|---|
| Treasury | Live — quantity-based, FX snapshots, manual refresh |
| Accounts | Live — lifecycle (active / inactive / deleted) added in pending migration |
| Contacts | Live — notes, ledger, country flags |
| Products | Live — wizard form, image upload |
| Orders | Live — full lifecycle, batch import, proforma metadata, PDF |
| Shipments | Live — freight allocation, capacity, statement PDF, documents |
| Transactions | Live (Wave 1 kinds) — order_billing & supplier flows deferred |
| Partners | Live — loans, profit distributions, PSD calendar, reimbursements |
| Tax (KDV) | Live — collected/paid summary, CSV export |
| Profit & Loss | Live — monthly view + FX overrides (pending migration) |
| Dashboard | Live (prototype) — editorial layout, attention rules |
| Settings | Reserved (placeholder) |
