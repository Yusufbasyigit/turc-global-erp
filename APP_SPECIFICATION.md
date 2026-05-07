# APP SPECIFICATION — Turc Global ERP

> Reconstruction-grade specification. If the codebase were lost, a developer should be able to rebuild full feature parity with only this document. Compiled 2026-05-04 from a complete read of `/Users/yusufbasyigit/Desktop/turc-global-erp` (main branch, commit `d1efd41`).

---

## Table of Contents

1. [Project Foundation](#1-project-foundation)
2. [Data Layer](#2-data-layer)
3. [Backend / API (Queries, Mutations, Edge Functions)](#3-backend--api)
4. [Accounting & Business Logic (Deep Dive)](#4-accounting--business-logic-deep-dive)
5. [Frontend — Pages & Routes](#5-frontend--pages--routes)
6. [Frontend — Navigation Map](#6-frontend--navigation-map)
7. [Frontend — Reusable Components](#7-frontend--reusable-components)
8. [File Handling & Document Generation](#8-file-handling--document-generation)
9. [Integrations](#9-integrations)
10. [Authentication & Authorization](#10-authentication--authorization)
11. [Internationalization](#11-internationalization)
12. [Non-Functional Details](#12-non-functional-details)
13. [Dead Code / Unused](#13-dead-code--unused)
14. [Open Questions](#14-open-questions)

---

## 1. Project Foundation

### 1.1 Identity & Purpose

- **Name:** Turc Global ERP
- **Owner:** Turc Global Danışmanlık ve Dış Ticaret LTD. ŞTİ. — a Turkish export trading company that added a real-estate (rentals/sales) line in April 2026.
- **Audience:** Single-tenant, owner-managed (no role-based access).
- **Languages:** App UI is English-only (no exception). PDFs (`src/lib/pdf/`) are French (export shipping docs). Some Turkish domain terms are preserved verbatim: Kasa, Ortak, Şirket, Vergi Dairesi, Yükleme Talimatı, KDV.
- **Theme:** Light mode only (warm-paper "Editorial Ledger / Defter" palette). No dark-mode toggle.

### 1.2 Tech Stack (exact versions from `package.json`)

| Dependency | Version | Role |
|---|---|---|
| `next` | `16.2.4` | App-Router framework (React Compiler, Turbopack dev). Note: `middleware.ts` is renamed to `proxy.ts` in Next 16. |
| `react` / `react-dom` | `19.2.4` | UI runtime |
| `typescript` | `^5` | Strict mode |
| `@supabase/ssr` | `^0.10.2` | Cookie-based Supabase auth helpers |
| `@supabase/supabase-js` | `^2.104.0` | Supabase client |
| `@tanstack/react-query` | `^5.99.2` | Server state |
| `@tanstack/react-query-devtools` | `^5.99.2` | Dev-only devtools |
| `react-hook-form` | `^7.73.1` | Forms |
| `@hookform/resolvers` | `^5.2.2` | Zod ⇄ RHF bridge |
| `zod` | `^4.3.6` | Schema validation |
| `tailwindcss` | `^4` | Styling (v4 with `@tailwindcss/postcss`) |
| `tw-animate-css` | `^1.4.0` | Tailwind animation utilities |
| `radix-ui` | `^1.4.3` | Headless primitives |
| `class-variance-authority` | `^0.7.1` | Variant utility |
| `clsx` | `^2.1.1` | Class merging |
| `tailwind-merge` | `^3.5.0` | Tailwind dedupe |
| `cmdk` | `^1.1.1` | Command-menu primitive |
| `date-fns` | `^4.1.0` | Date math |
| `lucide-react` | `^1.8.0` | Icons |
| `sonner` | `^2.0.7` | Toasts |
| `@react-pdf/renderer` | `^4.5.1` | PDF generation |
| `shadcn` | `^4.4.0` (devDep) | shadcn CLI |
| `eslint-config-next` | `16.2.4` | ESLint config |

### 1.3 Folder Structure

```
.
├── CLAUDE.md                  # Briefing (workflow rules)
├── AGENTS.md                  # One-line note: read Next 16 docs in node_modules first
├── README.md                  # Run / deploy / test instructions
├── decisions.md               # Append-only architectural log (newest first)
├── treasury.md                # Treasury principles ("quantity is source of truth")
├── transaction-types-audit.md # 2026-04-28 audit of transaction kinds
├── scenario-report-2026-04-28.md  # E2E scenario report
├── package.json
├── tsconfig.json              # `@/*` → `./src/*`
├── next.config.ts             # Turbopack root + outputFileTracingExcludes
├── proxy.ts                   # (under src/) Next 16 middleware-equivalent
├── eslint.config.mjs
├── postcss.config.mjs
├── components.json            # shadcn config (style "radix-nova", neutral base)
├── public/
│   ├── logo.png               # Used by PDFs (overridable via PDF_LOGO_OVERRIDE)
│   ├── just-tg.png            # Sidebar icon
│   ├── tg-logo.png
│   └── tg-logo-white.png
├── samples/                   # Generated sample PDFs / CSVs (output of render-sample-pdfs.tsx)
├── handoff/                   # Handoff notes
├── assets/                    # Design / planning assets
├── scripts/
│   ├── run-tests.mjs          # Discovers and runs every src/**/*.test.ts via tsx
│   ├── render-sample-pdfs.tsx # Renders bundled sample documents to disk
│   ├── preflight-snapshot.mjs # Snapshots row counts before/after e2e tests
│   ├── e2e-walk.ts            # 2,688-line scripted E2E walkthrough of all modules
│   ├── edge-cases.ts          # 1,889-line invariant stress tests
│   └── sample-data/
│       ├── company.ts         # SAMPLE_COMPANY fixture (Turkish characters)
│       ├── kdv-samples.ts     # KDV transaction fixtures
│       ├── proforma-samples.ts# Multiple proforma fixtures
│       └── statement-samples.ts# Shipment statement fixtures
├── supabase/
│   ├── config.toml            # project_id; functions verify_jwt config
│   ├── migrations/            # Source-of-truth SQL (timestamped, applied via `supabase db push`)
│   └── functions/
│       └── refresh-rates/     # Deno edge function (cron + manual)
└── src/
    ├── app/                   # Next App Router
    │   ├── layout.tsx         # Root: fonts, Toaster, Providers
    │   ├── page.tsx           # `/` — redirects to /dashboard
    │   ├── globals.css        # Editorial Defter palette + utilities
    │   ├── login/page.tsx     # Magic-link sign in
    │   ├── auth/
    │   │   ├── callback/route.ts  # GET — exchanges code → session
    │   │   └── signout/route.ts   # POST — sign out, redirect /login
    │   └── (app)/             # Authed sidebar shell
    │       ├── layout.tsx     # Server-side auth guard, sidebar
    │       ├── error.tsx      # Generic error boundary
    │       ├── loading.tsx    # Skeleton placeholder
    │       ├── dashboard/page.tsx
    │       ├── contacts/{page.tsx, [id]/page.tsx}
    │       ├── partners/{page.tsx, [id]/{page.tsx, loading.tsx, not-found.tsx}}
    │       ├── products/{page.tsx, [id]/page.tsx}
    │       ├── orders/{page.tsx, [id]/page.tsx}
    │       ├── shipments/{page.tsx, [id]/page.tsx}
    │       ├── treasury/page.tsx
    │       ├── accounts/{page.tsx, [id]/page.tsx}
    │       ├── transactions/page.tsx
    │       ├── tax/page.tsx
    │       ├── profit-loss/page.tsx
    │       ├── real-estate/page.tsx
    │       └── settings/page.tsx
    ├── features/              # Feature-keyed code
    │   ├── accounts/          # Account list/detail, lifecycle
    │   ├── contacts/          # Customers, suppliers, logistics, real_estate, other (shared)
    │   ├── dashboard/         # Snapshot cards + attention list
    │   ├── orders/            # Order lifecycle + proforma
    │   ├── partners/          # Equity, loans, PSD, reimbursements
    │   ├── products/
    │   ├── profit-loss/       # Monthly/quarterly/annual P&L
    │   ├── real-estate/       # Rentals/sales (Apr 2026 line)
    │   ├── recurring-payments/
    │   ├── settings/          # Company info, custody locations
    │   ├── shipments/         # Logistics + accrual billing
    │   ├── tax/               # KDV (Turkish VAT)
    │   ├── transactions/
    │   └── treasury/          # Custody, accounts, FX/price snapshots
    ├── components/
    │   ├── app-sidebar.tsx
    │   ├── editorial-topbar.tsx  # (Unused — see Dead Code)
    │   ├── login-form.tsx
    │   ├── user-menu.tsx
    │   ├── coming-soon.tsx       # (Unused — see Dead Code)
    │   ├── providers.tsx         # QueryClient + Devtools
    │   └── ui/                   # shadcn primitives (copied, editable)
    ├── hooks/
    │   └── use-mobile.ts
    ├── lib/
    │   ├── auth-mode.ts          # AUTH_DISABLED dev bypass
    │   ├── constants.ts          # Bucket names, file size/MIME limits, badge classes
    │   ├── format-date.ts
    │   ├── format-money.ts
    │   ├── query-client.ts
    │   ├── utils.ts              # cn()
    │   ├── supabase/{client,server,types}.ts
    │   ├── ledger/               # Pure ledger functions (FIFO, KDV, installment, partner reimbursement)
    │   ├── pdf/                  # @react-pdf/renderer documents (French export docs)
    │   ├── proforma/             # Offer numbering, Istanbul date, schemas, money helpers
    │   └── shipments/dimensions.ts
    └── types/
        └── database.ts           # Generated by `npm run db:types`
```

### 1.4 Build, Run, Test, Deploy Commands

| Command | Purpose |
|---|---|
| `npm install` | Install deps (Node 20+ required) |
| `npm run dev` | Start dev server (Turbopack, http://localhost:3000) |
| `npm run build` | Production build |
| `npm run start` | Run production build locally |
| `npm run lint` | ESLint (using `eslint-config-next`) |
| `npm run lint:fix` | ESLint with autofix |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Custom runner (`scripts/run-tests.mjs`) discovers every `src/**/*.test.{ts,tsx}` via `tsx`, parses each suite's `N passed, M failed` line, exits non-zero on failure. Filter via `npm test -- <substring>`. |
| `npm run db:types` | `supabase gen types typescript --project-id $SUPABASE_PROJECT_REF --schema public > src/types/database.ts` |

**Deploy:** Vercel auto-build from GitHub `main`. After first deploy:
1. Set `NEXT_PUBLIC_SITE_URL` to the assigned Vercel domain.
2. Add `https://<vercel-domain>/auth/callback` and `http://localhost:3000/auth/callback` under Supabase → Authentication → URL Configuration.

**Migrations:** SQL files live under `supabase/migrations/`. Apply via `supabase db push` from the CLI (interactive confirmation each time). Regenerate types with `npm run db:types` and commit `src/types/database.ts`.

### 1.5 Conventions

- **Path alias:** `@/*` → `./src/*` (tsconfig `paths`).
- **TypeScript strict:** `strict: true`, `noEmit: true`, `target: ES2017`, `module: esnext`, `moduleResolution: bundler`.
- **File naming:** kebab-case for files, PascalCase for components, camelCase for functions.
- **Feature isolation:** Each `features/<module>/` directory contains its own `queries.ts`, `mutations.ts`, `schema.ts` (Zod), `constants.ts`, plus React `*.tsx` components.
- **Forms:** React Hook Form + Zod resolver (`@hookform/resolvers/zod`).
- **Server state:** TanStack Query with module-scoped key factories (e.g. `treasuryKeys.accounts()`).
- **No SSR data fetching besides auth:** Pages mostly render client components that own their queries.
- **No Server Actions:** Mutations live in client-side `mutations.ts` modules, called from React Hook Form `onSubmit`.
- **Soft deletes:** `deleted_at timestamptz NULL` on `accounts`, `contacts`, `partners`, `products`, `recurring_payments`, `real_estate_deals`, `psd_events`.
- **Audit stamps:** Most tables carry `created_by`, `created_time`, `edited_by`, `edited_time`. Stamps are `null` when `AUTH_DISABLED=true`.
- **No Row-Level Security yet:** Every migration explicitly disables RLS (`disable row level security`). Production-auth rollout is deferred — the app gate is currently the only protection.
- **Tests:** Plain TS scripts (no Jest/Vitest). Each defines local `assertEq`, `section`, then prints `N passed, M failed` and exits non-zero on failure. Tests must be pure (no DB, no network, no FS).
- **Comments:** Sparse — code is well-named. Complex modules (e.g. `lib/ledger/fifo-allocation.ts`) carry block-level documentation explaining algorithms.

### 1.6 Environment Variables

All listed in `.env.local.example`:

| Variable | Required | Purpose | Example |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL | `https://tpskndvtagnoklpfrusu.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Anon key (safe in browser) | `eyJhbGciOi…` |
| `NEXT_PUBLIC_SITE_URL` | Yes | Base URL for magic-link redirects | `http://localhost:3000` (dev) / Vercel domain (prod) |
| `SUPABASE_PROJECT_REF` | Local only | Used by `npm run db:types` (not at runtime) | `tpskndvtagnoklpfrusu` |
| `NEXT_PUBLIC_DISABLE_AUTH` | Optional dev | `"true"` short-circuits the auth gate; sidebar shows `dev@local`; mutations stamp `created_by`/`edited_by` as `null` | `false` (unset = false) |
| `SUPABASE_SERVICE_ROLE_KEY` | Optional, audits only | Used exclusively by `scripts/e2e-walk.ts` for cross-RLS reads. Must NOT be prefixed `NEXT_PUBLIC_`. | `eyJhbGciOi…` (omit in normal use) |
| `PDF_LOGO_OVERRIDE` | Optional, sample renderer | Absolute filesystem path to a logo image; lets Node-side PDF rendering bypass the browser-only `/logo.png`. | `/Users/yusuf/.../public/logo.png` |
| `NEXT_PUBLIC_PDF_FONTS_AVAILABLE` | Optional, browser PDF | `"true"` activates Inter/InstrumentSerif/JetBrainsMono Unicode fonts in browser PDF rendering (otherwise WinAnsi fallback with diacritic transliteration). | `false` |
| `PDF_FONTS_DIR` | Optional, Node PDF | Absolute filesystem path to the fonts directory; activates Unicode fonts in Node tests/sample renderer. | `/path/to/fonts/` |

---


## 2. Data Layer

All schema lives in PostgreSQL on Supabase. The source-of-truth is `supabase/migrations/` (timestamped SQL files, applied via `supabase db push`). Every migration disables RLS on its tables (`alter table ... disable row level security`) — the app gate is the only access control today.

### 2.1 Migration History (chronological)

| File | Purpose |
|---|---|
| `20260325170000_pre_repo_history.sql` | Stub — migrations applied to remote before the repo existed (parity marker). Empty. |
| `20260326130000_pre_repo_history.sql` | Stub. |
| `20260326140000_pre_repo_history.sql` | Stub. |
| `20260422120000_treasury_movements.sql` | Creates `treasury_movements` (quantity-as-source-of-truth). Adds `custody_locations.requires_movement_type`, sets it true on the seed row named "Ortak". |
| `20260422130000_treasury_disable_rls.sql` | Disables RLS on `custody_locations`, `fx_snapshots`, `price_snapshots`. |
| `20260423120000_transactions_foundation.sql` | Drops V1 `transactions`, creates `partners` (seeded with 'Partner 1/2/3'), and the redesigned `transactions` table; links `treasury_movements.source_transaction_id` back to it. |
| `20260423130000_related_payable.sql` | Adds `transactions.related_payable_id` (self-FK), with CHECK that it's only set on `kind = 'supplier_payment'`. |
| `20260423140000_orders_shipments_rebuild.sql` | Drops V1 `orders/order_details/shipments/order_status_history`. Creates new `shipments` (4-state lifecycle), `orders` (7-state lifecycle), `order_details` with snapshot columns. Adds `products.hs_code`. Adds `'shipment_billing'` to `transactions.kind` CHECK. |
| `20260424120000_shipment_statement_pdf.sql` | Adds `shipments.generated_statement_pdf` column (path pointer). |
| `20260425120000_rate_refresh_runs.sql` | Creates `rate_refresh_runs` audit table for FX/price refresh runs. |
| `20260425120001_schedule_refresh_rates_cron.sql` | Schedules `refresh-rates-weekday-morning` pg_cron job at 06:00 UTC weekdays (= 09:00 Istanbul). Requires Vault secrets `refresh_rates_function_url` and `service_role_key`. |
| `20260425130000_accounts_lifecycle.sql` | Adds `accounts.is_active`, `accounts.deleted_at`. Creates partial unique index `accounts_unique_active_name_idx` on `lower(account_name) WHERE deleted_at IS NULL`. Defensive dedupe of pre-existing collisions. |
| `20260425140000_monthly_fx_overrides.sql` | Creates `monthly_fx_overrides` (manual FX pin per (period, currency) for P&L). |
| `20260426120000_kdv_period.sql` | Adds `transactions.kdv_period text`, with CHECK shape `^[0-9]{4}-(0[1-9]|1[0-2])$` and CHECK that it's only set on `kind = 'tax_payment'`. |
| `20260427120000_transactions_shipment_fk.sql` | Adds the long-missing FK `transactions.related_shipment_id → shipments.id ON DELETE SET NULL`. NULLs orphans defensively. Idempotent via `pg_constraint` lookup. |
| `20260427130000_contact_notes_disable_rls.sql` | Disables RLS on `contact_notes`. |
| `20260427140000_seed_countries.sql` | Disables RLS on `countries`, then seeds ~115 countries (code, name_en, name_tr, flag_emoji). Used by contact form's country picker. |
| `20260427150000_psd_events.sql` | Creates `psd_events` (parent for profit-share distributions). Adds `transactions.psd_event_id`. CHECK enforces a `profit_distribution` row must belong to a PSD event AND must have `partner_id IS NULL`; all other kinds must have `psd_event_id IS NULL`. |
| `20260427160000_partner_loans.sql` | Adds `transactions.is_loan boolean DEFAULT false`. CHECK: `is_loan = true` requires `kind IN ('partner_loan_out','partner_loan_in')` AND `partner_id IS NOT NULL`. Creates `loan_installments` table. |
| `20260427170000_shipment_cogs_freight.sql` | Adds `'shipment_cogs'`, `'shipment_freight'` to `transactions.kind` CHECK. |
| `20260427180000_real_estate.sql` | Creates `real_estate_deals` (rent/sale, single-currency, contact_id FK), `real_estate_installments` (CASCADE on deal delete). Adds `transactions.real_estate_deal_id` with CHECK that it's only on `kind = 'client_payment'`. Also added `transactions.revenue_source` (later dropped). |
| `20260427190000_recurring_payments.sql` | Creates `recurring_payments` (templates) and `recurring_payment_occurrences` (lazy materialization on paid/skipped). |
| `20260427200000_seed_expense_types.sql` | Seeds five default expense types (Marketing & Sales, Operations & Logistics, Subscriptions & Software, Professional Services, Office & General/Transit). Idempotent via `WHERE NOT EXISTS`. |
| `20260427210000_drop_transaction_adjustment_kind.sql` | Drops `'adjustment'` from `transactions.kind` allowed list. |
| `20260428120000_collapse_other_expense.sql` | Collapses `'other_expense'` into `'expense'`. Seeds an `'Uncategorized'` expense_type and backfills any `other_expense` rows with no category. Tightens both CHECK constraints. |
| `20260428130000_drop_order_billing_kind.sql` | Drops `'order_billing'` (never used). Defensively aborts if any rows of that kind exist. |
| `20260428140000_remove_office_supplies_expense_type.sql` | Removes the manually-added "Office Supplies" expense_type (overlaps with seeded "Office & General/Transit"). NULLs references first. |
| `20260428160000_drop_revenue_source.sql` | Drops `transactions.revenue_source`. `real_estate_deal_id` is now sole source of truth for "is this real-estate revenue?". |
| `20260430120000_app_settings.sql` | Creates `app_settings` singleton (boolean PK forced true via CHECK). Seeds with the previously hardcoded company letterhead (`Turc Global Danışmanlık ve Dış Ticaret LTD. ŞTİ.`, address, phone, email). |
| `20260430130000_unique_shipment_accrual.sql` | Creates partial unique index `uniq_shipment_accrual ON transactions(related_shipment_id, kind) WHERE kind IN ('shipment_billing','shipment_cogs','shipment_freight') AND related_shipment_id IS NOT NULL`. Aborts if duplicates exist. |
| `20260504120000_seed_product_categories.sql` | Seeds seven default product categories (Food & Beverage, Textiles & Apparel, Furniture & Home Goods, Electronics & Appliances, Machinery & Equipment, Construction & Building Materials, Personal Care & Cosmetics). Idempotent. |

### 2.2 Tables — full schema

Below, every column carries: `name : type [NULL? default? constraints?]` followed by a plain-language note.

#### 2.2.1 `accounts`

A custody-aware "wallet" — one row per (asset, custody location). Quantity is computed from `treasury_movements`, never stored.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid PK default gen_random_uuid()` | |
| `account_name` | `text NOT NULL` | User-visible label. Case-insensitive unique among non-deleted rows (`accounts_unique_active_name_idx`). |
| `account_type` | `text NULL` | Free text (e.g. "Checking", "Savings") — descriptive only. |
| `asset_code` | `text NULL` | The asset ticker stored in this account. Fiat: ISO 4217 (USD, EUR, TRY, GBP). Crypto: BTC, USDT, etc. Metals: `Altın`, `Gümüş`, `XAU`, `XAG`. Funds: KTJ etc. |
| `asset_type` | `text NULL` | One of `'fiat' \| 'credit_card' \| 'crypto' \| 'metal' \| 'fund'` (`ASSET_TYPES` const). Drives refresh logic. |
| `bank_name` | `text NULL` | For bank accounts. |
| `iban` | `text NULL` | For bank accounts. |
| `subtype` | `text NULL` | Free text supplementary tag. |
| `shares` | `numeric NULL` | For fund holdings. |
| `custody_location_id` | `uuid NULL FK→custody_locations.id` | |
| `is_active` | `boolean NOT NULL default true` | False = hidden from pickers. Balance still computes. |
| `deleted_at` | `timestamptz NULL` | Soft delete. Hidden from registry. |
| `created_by`, `created_time`, `edited_by`, `edited_time` | audit | |

Indexes: `accounts_active_idx (id) WHERE deleted_at IS NULL AND is_active = true` — picker chokepoint.

#### 2.2.2 `app_settings`

Singleton row (boolean PK constrained to `true` via CHECK). Holds company letterhead used in PDFs.

| Column | Type | Notes |
|---|---|---|
| `id` | `boolean PK default true CHECK (id = true)` | Singleton enforcer. |
| `company_name` | `text NOT NULL` | e.g. "Turc Global Danışmanlık ve Dış Ticaret LTD. ŞTİ." |
| `address_line1` | `text NOT NULL` | e.g. "Çobançeşme Mah., Sanayi Cad. Vadi Sk. No:5" |
| `address_line2` | `text NOT NULL` | e.g. "34196 Bahçelievler · İstanbul · Türkiye" |
| `phone` | `text NOT NULL` | e.g. "+90 530 927 57 89" |
| `email` | `text NOT NULL` | e.g. "info@turcglobal.com" |
| `updated_by` | `uuid NULL FK→auth.users(id)` | |
| `updated_time` | `timestamptz NOT NULL default now()` | |

#### 2.2.3 `contacts`

Customers, suppliers, logistics, real-estate counterparties, and "other". Soft-deleted.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid PK default gen_random_uuid()` | |
| `company_name` | `text NOT NULL` | |
| `contact_person` | `text NULL` | |
| `type` | `text NULL` | One of `'customer' \| 'supplier' \| 'logistics' \| 'real_estate' \| 'other'` (`CONTACT_TYPES`). Plain text — application-side enforcement only. |
| `phone`, `email`, `address`, `city` | `text NULL` | |
| `country_code` | `text NULL FK→countries.code` | ISO 3166-1 alpha-2. |
| `balance_currency` | `text NULL` | One of `'TRY' \| 'EUR' \| 'USD' \| 'GBP'` (`BALANCE_CURRENCIES`). The currency in which the running ledger is summarized. |
| `tax_id` | `text NULL` | Turkish VKN if Turkish counterparty. |
| `tax_office` | `text NULL` | Turkish Vergi Dairesi (only set when country = TR). |
| `notes` | `text NULL` | Static context (e.g. "pays late"). |
| `deleted_at` | `timestamptz NULL` | Soft delete. |
| audit | | `created_by/time, edited_by/time`. |

#### 2.2.4 `contact_notes`

Activity log per contact (chronological).

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid PK default gen_random_uuid()` | |
| `contact_id` | `uuid NOT NULL FK→contacts.id` | |
| `body` | `text NOT NULL` | |
| `note_date` | `date NOT NULL default current_date` | Sortable note date (newest first). |
| `created_by`, `created_time` | audit | |

#### 2.2.5 `countries`

Lookup table seeded with ~115 countries (TR, US, FR, DE, etc.).

| Column | Type | Notes |
|---|---|---|
| `code` | `text PK` | ISO 3166-1 alpha-2. |
| `name_en` | `text NOT NULL` | English name. |
| `name_tr` | `text NULL` | Turkish translation. |
| `flag_emoji` | `text NULL` | Unicode flag emoji. |

#### 2.2.6 `custody_locations`

Where accounts physically/legally live. Editable in app via Settings.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid PK default gen_random_uuid()` | |
| `name` | `text NOT NULL` | e.g. "Şirket", "Ortak", "Kasa", "GAP 1", "Kasa Çekme". |
| `location_type` | `text NOT NULL` | `'bank' \| 'physical'` (`CUSTODY_LOCATION_TYPES`). |
| `requires_movement_type` | `boolean NOT NULL default false` | True for the "Ortak" custody — every transaction on it must record an `ortak_movement_type`. |
| `is_active` | `boolean NULL` | |
| audit | | |

#### 2.2.7 `expense_types`

Lookup for expense categorization. Seeded with five buckets plus an "Uncategorized" sentinel.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid PK default gen_random_uuid()` | |
| `name` | `text NOT NULL` | e.g. "Marketing & Sales". No unique constraint. |
| `description` | `text NULL` | |
| `category_group` | `text NULL` | Optional grouping. |
| `is_active` | `boolean NULL` | |

Seeded names: `Marketing & Sales`, `Operations & Logistics`, `Subscriptions & Software`, `Professional Services`, `Office & General/Transit`, `Uncategorized`.

#### 2.2.8 `fx_snapshots`

Daily fiat → USD rates (also USD = 1).

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid PK default gen_random_uuid()` | |
| `currency_code` | `text NOT NULL` | ISO code. |
| `rate_to_usd` | `numeric NOT NULL` | USD per 1 unit of currency. (For display, the UI inverts this: `1 USD = 1/rate TRY`.) |
| `snapshot_date` | `date NOT NULL` | The reporting day this rate is for (UTC date in API). |
| `fetched_at` | `timestamptz NOT NULL default now()` | When refreshed. |
| `source` | `text NULL` | e.g. `'frankfurter.dev'`. |

Upsert key (mutation layer): `(currency_code, snapshot_date, source)`.

#### 2.2.9 `loan_installments`

Expected installment schedule attached to a partner loan transaction.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid PK default gen_random_uuid()` | |
| `loan_transaction_id` | `uuid NOT NULL FK→transactions.id ON DELETE CASCADE` | |
| `due_date` | `date NOT NULL` | |
| `amount` | `numeric NOT NULL CHECK (amount > 0)` | |
| `currency` | `text NOT NULL` | |
| `created_time` | `timestamptz NOT NULL default now()` | |

Indexes: `(loan_transaction_id)`, `(due_date)`.

#### 2.2.10 `monthly_fx_overrides`

Manual USD/TRY (or any currency) pin for a given month, used by the P&L module.

| Column | Type | Notes |
|---|---|---|
| `period` | `text NOT NULL CHECK (~ '^[0-9]{4}-(0[1-9]|1[0-2])$')` | YYYY-MM. |
| `currency_code` | `text NOT NULL` | |
| `rate_to_usd` | `numeric NOT NULL CHECK (rate_to_usd > 0)` | Same convention as `fx_snapshots`: USD per 1 unit. |
| `note` | `text NULL` | Optional rationale. |
| `set_at` | `timestamptz NOT NULL default now()` | |
| `set_by` | `uuid NULL FK→auth.users(id)` | |
| **PK** | `(period, currency_code)` | |

#### 2.2.11 `orders`

Sales order header. 7-status lifecycle.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid PK default gen_random_uuid()` | |
| `customer_id` | `uuid NOT NULL FK→contacts.id` | |
| `order_date` | `date NOT NULL default current_date` | |
| `order_currency` | `text NOT NULL` | One of `BALANCE_CURRENCIES`. |
| `status` | `text NOT NULL default 'inquiry' CHECK (...)` | `'inquiry' \| 'quoted' \| 'accepted' \| 'in_production' \| 'shipped' \| 'delivered' \| 'cancelled'` (`ORDER_STATUSES`). |
| `shipment_id` | `uuid NULL FK→shipments.id` | Physical shipment. |
| `billing_shipment_id` | `uuid NULL FK→shipments.id` | Financial / invoicing shipment. May diverge from `shipment_id` for rolled-over orders. |
| `notes` | `text NULL` | Internal notes (preformatted). |
| `customer_po_file` | `text NULL` | Storage path under `order-attachments/{order_id}/customer_po/...`. |
| `proposal_pdf` | `text NULL` | Storage path under `order-attachments/{order_id}/proposal/{offer_number}.pdf`. |
| **Proforma metadata** | | All optional: |
| `offer_number` | `text NULL` | Format `TG-YYYYMMDD-NNN`. |
| `offer_date` | `date NULL` | |
| `offer_valid_until` | `date NULL` | |
| `incoterm` | `text NULL` | e.g. `EXW Istanbul`. |
| `delivery_timeline` | `text NULL` | |
| `payment_terms` | `text NULL` | |
| `proforma_notes_remark` | `text NULL` | Defaults to: "This offer is denominated in {currency}. VAT: 0% (export)." |
| `proforma_notes_validity` | `text NULL` | |
| `proforma_notes_delivery_location` | `text NULL` | |
| `proforma_notes_production_time` | `text NULL` | |
| `proforma_notes_length_tolerance` | `text NULL` | |
| `proforma_notes_total_weight` | `text NULL` | |
| `cancelled_at` | `timestamptz NULL` | |
| `cancellation_reason` | `text NULL` | |
| audit | | |

Constraint: `CHECK ((status = 'cancelled') = (cancelled_at IS NOT NULL))` — invariant.

Indexes: `customer_id`, `status`, `order_date`, `shipment_id`, `billing_shipment_id`.

#### 2.2.12 `order_details`

One row per order line. Carries product *snapshots* so historical orders are immutable when the product master changes.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid PK` | |
| `order_id` | `uuid NOT NULL FK→orders.id ON DELETE CASCADE` | |
| `product_id` | `uuid NOT NULL FK→products.product_id` | |
| `line_number` | `int NOT NULL` | Unique per order (`order_details_order_line_idx`). |
| `quantity` | `numeric NOT NULL` | |
| `unit_sales_price` | `numeric NULL` | Filled before quoting; gates `inquiry → quoted`. |
| `est_purchase_unit_price` | `numeric NULL` | Internal estimate. |
| `actual_purchase_price` | `numeric NULL` | Optionally entered after the fact. |
| `vat_rate` | `numeric NULL` | One of 0/1/10/20 (KDV_RATES). |
| `supplier_id` | `uuid NULL FK→contacts.id` | Per-line supplier override. |
| **Snapshots** (copied from product at line creation time): | | |
| `product_name_snapshot` | `text NOT NULL` | |
| `product_description_snapshot` | `text NULL` | |
| `product_photo_snapshot` | `text NULL` | Storage path. |
| `unit_snapshot` | `text NOT NULL` | e.g. "kg", "pcs". |
| `cbm_per_unit_snapshot` | `numeric NULL` | |
| `weight_kg_per_unit_snapshot` | `numeric NULL` | |
| **Per-line packaging override:** | | |
| `packaging_type` | `text NULL` | One of `'box' \| 'pallet' \| 'carton' \| 'bag' \| 'other'` (`PACKAGING_TYPES`). |
| `package_length_cm` | `numeric NULL` | |
| `package_width_cm` | `numeric NULL` | |
| `package_height_cm` | `numeric NULL` | |
| `units_per_package` | `numeric NULL` | |
| `notes` | `text NULL` | |
| audit | | |

#### 2.2.13 `partners`

Internal partners (3 owners). Minimal — no balance currency, no running balance.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid PK default gen_random_uuid()` | |
| `name` | `text NOT NULL` | Max 100 chars (form). |
| `is_active` | `boolean NOT NULL default true` | |
| `deleted_at` | `timestamptz NULL` | Dual lifecycle: deactivate vs. delete. |
| audit | | |

Seeded: 'Partner 1', 'Partner 2', 'Partner 3'.

#### 2.2.14 `price_snapshots`

Daily non-fiat asset prices (crypto, metals, funds).

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid PK default gen_random_uuid()` | |
| `asset_code` | `text NOT NULL` | Mirrors `accounts.asset_code`. |
| `price` | `numeric NOT NULL` | Price per 1 unit in `price_currency`. |
| `price_currency` | `text NOT NULL` | Usually `USD`. |
| `snapshot_date` | `date NOT NULL` | |
| `created_at` | `timestamptz NULL default now()` | |
| `source` | `text NULL` | `'coinpaprika.com'` or `'gold-api.com'`. |

Upsert key (mutation): `(asset_code, snapshot_date, source)`.

#### 2.2.15 `product_categories`

Lookup for products. Seeded with 7 buckets; in-app create supported via combobox.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid PK default gen_random_uuid()` | |
| `name` | `text NOT NULL` | |
| audit | | |

Seeds: `Food & Beverage`, `Textiles & Apparel`, `Furniture & Home Goods`, `Electronics & Appliances`, `Machinery & Equipment`, `Construction & Building Materials`, `Personal Care & Cosmetics`.

#### 2.2.16 `products`

Master product catalog. Soft-deleted.

| Column | Type | Notes |
|---|---|---|
| `product_id` | `uuid PK default gen_random_uuid()` | (Note column name is `product_id`, not `id`.) Generated client-side before insert so image upload can use the path `{product_id}/{filename}` before the row exists. |
| `product_name` | `text NULL` | Internal name. |
| `client_product_name` | `text NULL` | Customer-facing name (used on proforma). |
| `client_description` | `text NULL` | Description used on proforma. |
| `unit` | `text NULL` | "kg", "pcs", "m"... |
| `category_id` | `uuid NULL FK→product_categories.id` | |
| `default_supplier` | `uuid NULL FK→contacts.id` | |
| `barcode_value` | `text NULL` | |
| `hs_code` | `text NULL` | Harmonized System code. |
| `kdv_rate` | `numeric NULL` | One of 0/1/10/20. |
| `est_purchase_price` | `numeric NULL` | |
| `est_currency` | `text NULL` | |
| `default_sales_price` | `numeric NULL` | |
| `sales_currency` | `text NULL` | |
| `cbm_per_unit` | `numeric NULL` | Authoritative CBM if filled; otherwise derived from package dimensions / units_per_package. |
| `weight_kg_per_unit` | `numeric NULL` | |
| `packaging_type` | `text NULL` | |
| `package_length_cm`, `package_width_cm`, `package_height_cm`, `units_per_package` | `numeric NULL` | |
| `product_image` | `text NULL` | Storage path under `product-photos/{product_id}/...`. |
| `is_active` | `boolean NULL` | |
| `deleted_at` | `timestamptz NULL` | |
| audit | | |

#### 2.2.17 `psd_events`

Profit-share distribution events. One event can have multiple legs (one per currency/source-account), stored as `transactions` with `kind='profit_distribution'` linked back via `psd_event_id`.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid PK default gen_random_uuid()` | |
| `event_date` | `date NOT NULL` | |
| `fiscal_period` | `text NULL` | Optional (`YYYY`, `YYYY-QX`, or `YYYY-MM`). |
| `note` | `text NULL` | |
| `deleted_at` | `timestamptz NULL` | |
| audit | | |

Index: `(event_date)`.

#### 2.2.18 `rate_refresh_runs`

Audit log of every FX/price refresh attempt (cron or manual).

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid PK default gen_random_uuid()` | |
| `ran_at` | `timestamptz NOT NULL default now()` | |
| `triggered_by` | `text NOT NULL CHECK (in ('cron','manual'))` | |
| `fx_outcome` | `jsonb NULL` | `{ inserted, skipped: string[], errors: string[] }` |
| `price_outcome` | `jsonb NULL` | Same shape. |
| `error_message` | `text NULL` | Set if either outcome was rejected. |

Index: `(ran_at desc)`.

#### 2.2.19 `real_estate_deals`

Single-currency rent or sale agreement. Soft-deleted.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid PK default gen_random_uuid()` | |
| `label` | `text NOT NULL` | Free text, e.g. "Şişli daire kira". Case-insensitive unique among non-deleted (`real_estate_deals_label_unique`). |
| `sub_type` | `text NOT NULL CHECK (in ('rent','sale'))` | (`REAL_ESTATE_SUB_TYPES`) |
| `contact_id` | `uuid NOT NULL FK→contacts.id` | |
| `currency` | `text NOT NULL CHECK (in ('TRY','EUR','USD','GBP'))` | |
| `start_date` | `date NOT NULL` | |
| `notes` | `text NULL` | |
| `deleted_at` | `timestamptz NULL` | |
| audit | | |

#### 2.2.20 `real_estate_installments`

Expected payment schedule for a deal.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid PK default gen_random_uuid()` | |
| `deal_id` | `uuid NOT NULL FK→real_estate_deals.id ON DELETE CASCADE` | |
| `due_date` | `date NOT NULL` | |
| `expected_amount` | `numeric NOT NULL CHECK (>0)` | |
| `sequence` | `int NOT NULL` | Unique per deal (`UNIQUE(deal_id, sequence)`). |
| `created_time` | `timestamptz NOT NULL default now()` | |

#### 2.2.21 `recurring_payments`

Templates for monthly recurring outflows.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid PK default gen_random_uuid()` | |
| `name` | `text NOT NULL` | |
| `description` | `text NULL` | |
| `kind` | `text NOT NULL default 'expense' CHECK (in ('expense','supplier_payment','tax_payment'))` | The transaction kind to spawn on mark-paid. |
| `expected_amount` | `numeric NOT NULL CHECK (>0)` | |
| `currency` | `text NOT NULL CHECK (in ('TRY','EUR','USD','GBP'))` | |
| `day_of_month` | `int NOT NULL CHECK (1..31)` | App clamps to last-of-month if month is shorter. |
| `account_id` | `uuid NOT NULL FK→accounts.id` | |
| `contact_id` | `uuid NULL FK→contacts.id` | |
| `expense_type_id` | `uuid NULL FK→expense_types.id` | |
| `effective_from` | `date NOT NULL` | First eligible month (first-of-month at creation by default). |
| `end_date` | `date NULL` | Last eligible month. |
| `status` | `text NOT NULL default 'active' CHECK (in ('active','paused'))` | |
| `notes` | `text NULL` | |
| `deleted_at` | `timestamptz NULL` | Soft delete. |
| audit | | |

Indexes: `(status) WHERE deleted_at IS NULL`, `(account_id)`, `(contact_id)`.

#### 2.2.22 `recurring_payment_occurrences`

Lazy materialization — one row per (template, year, month) only when paid or skipped.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid PK default gen_random_uuid()` | |
| `recurring_payment_id` | `uuid NOT NULL FK→recurring_payments.id ON DELETE CASCADE` | |
| `period_year` | `int NOT NULL` | |
| `period_month` | `int NOT NULL CHECK (1..12)` | |
| `status` | `text NOT NULL CHECK (in ('paid','skipped'))` | |
| `paid_amount` | `numeric NULL CHECK (paid_amount IS NULL OR > 0)` | |
| `paid_date` | `date NULL` | |
| `transaction_id` | `uuid NULL FK→transactions.id ON DELETE SET NULL` | If user deletes the spawned transaction directly, the occurrence row stays so the month doesn't auto-resurrect as pending. |
| `notes` | `text NULL` | |
| `UNIQUE (recurring_payment_id, period_year, period_month)` | | |
| audit | | |

#### 2.2.23 `shipments`

Physical and financial grouping of orders. 4-status lifecycle.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid PK default gen_random_uuid()` | |
| `customer_id` | `uuid NOT NULL FK→contacts.id` | |
| `name` | `text NOT NULL` | Display label, e.g. "Shipment #3". |
| `tracking_number` | `text NULL` | |
| `transport_method` | `text NULL CHECK (in ('sea','road','air','other'))` | (`TRANSPORT_METHODS`) |
| `container_type` | `text NULL` | One of `'20DC' \| '40DC' \| '40HC' \| '40RF'` (`CONTAINER_TYPE_OPTIONS`). Free text in DB. |
| `vessel_name` | `text NULL` | |
| `etd_date` | `date NULL` | Estimated departure. |
| `eta_date` | `date NULL` | Estimated arrival. |
| `status` | `text NOT NULL default 'draft' CHECK (in ('draft','booked','in_transit','arrived'))` | (`SHIPMENT_STATUSES`) |
| `freight_cost` | `numeric NULL` | |
| `freight_currency` | `text NULL` | |
| `invoice_currency` | `text NOT NULL` | The customer-facing invoice currency for accruals. |
| `notes` | `text NULL` | |
| `documents_file` | `text NULL` | Single storage path under `shipment-documents/{shipment_id}/...`. |
| `generated_statement_pdf` | `text NULL` | Latest statement path under `shipment-invoices/{shipment_id}/statement-{ts}.pdf`. Old versions retained. |
| audit | | |

Indexes: `customer_id`, `status`, `etd_date`.

#### 2.2.24 `transactions`

Universal financial event table. Discriminated by `kind`.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid PK default gen_random_uuid()` | |
| `transaction_date` | `date NOT NULL` | |
| `kind` | `text NOT NULL CHECK (...)` | One of `'client_payment' \| 'client_refund' \| 'supplier_payment' \| 'supplier_invoice' \| 'expense' \| 'other_income' \| 'partner_loan_in' \| 'partner_loan_out' \| 'profit_distribution' \| 'tax_payment' \| 'shipment_billing' \| 'shipment_cogs' \| 'shipment_freight'`. (`'order_billing'`, `'other_expense'`, `'adjustment'` were dropped — see migrations.) |
| `amount` | `numeric NOT NULL CHECK (>0)` | Always positive — sign comes from `kind`. |
| `currency` | `text NOT NULL` | |
| `description` | `text NULL` | |
| `reference_number` | `text NULL` | Document number (e.g. "BEYAN-2026-04", supplier invoice number). |
| `attachment_path` | `text NULL` | Storage path under `transaction-attachments/`. |
| **Foreign references (mostly nullable):** | | |
| `from_account_id` | `uuid NULL FK→accounts.id` | Source treasury account — for cash-out kinds. |
| `to_account_id` | `uuid NULL FK→accounts.id` | Destination treasury account — for cash-in kinds. |
| `contact_id` | `uuid NULL FK→contacts.id` | Customer/supplier counterparty. |
| `partner_id` | `uuid NULL FK→partners.id` | Internal partner. **CHECK enforces XOR with `contact_id`** — both null is allowed; both set is not. |
| `expense_type_id` | `uuid NULL FK→expense_types.id` | Required by `kind='expense'` form. |
| `related_order_id` | `uuid NULL` | Unconstrained. Reserved for future order-level links. |
| `related_shipment_id` | `uuid NULL FK→shipments.id ON DELETE SET NULL` | Set on shipment accruals (`shipment_billing`, `shipment_cogs`, `shipment_freight`); also informational on payments. |
| `related_payable_id` | `uuid NULL FK→transactions.id ON DELETE SET NULL` | Self-FK. Optional link from a `supplier_payment` to the `supplier_invoice` it (partly) settles. CHECK: only set when `kind='supplier_payment'`. |
| `psd_event_id` | `uuid NULL FK→psd_events.id ON DELETE CASCADE` | CHECK: a `profit_distribution` row MUST have this set AND `partner_id IS NULL`; all other kinds MUST have it null. |
| `real_estate_deal_id` | `uuid NULL FK→real_estate_deals.id` | CHECK: only `kind='client_payment'` may carry this. |
| **VAT (optional, on accrual/expense rows):** | | |
| `vat_rate` | `numeric NULL` | |
| `vat_amount` | `numeric NULL` | |
| `net_amount` | `numeric NULL` | |
| **FX freeze (for client_payment in non-balance currency):** | | |
| `fx_rate_applied` | `numeric NULL` | |
| `fx_target_currency` | `text NULL` | The customer's `balance_currency`. |
| `fx_converted_amount` | `numeric NULL` | The amount expressed in `fx_target_currency` at receipt time. Frozen — never recomputed. |
| **Loan flag:** | | |
| `is_loan` | `boolean NOT NULL default false` | CHECK: when true, `kind IN ('partner_loan_out','partner_loan_in')` AND `partner_id IS NOT NULL`. |
| **KDV period (for tax payments):** | | |
| `kdv_period` | `text NULL CHECK (~ '^[0-9]{4}-(0[1-9]|1[0-2])$' OR NULL)` | CHECK: only set when `kind='tax_payment'`. |
| audit | | |

Constraints:
- `CHECK ((contact_id IS NULL) OR (partner_id IS NULL))` — XOR.
- `CHECK (related_payable_id IS NULL OR kind = 'supplier_payment')`.
- `CHECK (kdv_period ...)` shape.
- `CHECK (psd_event_id ...)` profit-distribution invariant.
- `CHECK (is_loan ...)` loan invariant.
- `CHECK (real_estate_deal_id IS NULL OR kind='client_payment')`.
- **Partial unique index `uniq_shipment_accrual ON (related_shipment_id, kind) WHERE kind IN ('shipment_billing','shipment_cogs','shipment_freight') AND related_shipment_id IS NOT NULL`** — guarantees one accrual per (shipment, kind).

Indexes: `transaction_date`, `kind`, `contact_id`, `partner_id`, `related_payable_id`, `related_shipment_id`, `psd_event_id`, `kdv_period (where not null)`, `is_loan (where true)`, `real_estate_deal_id (where not null)`.

#### 2.2.25 `treasury_movements`

Quantity changes on `accounts`. Pure ledger of movements; balance is always SUM(quantity).

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid PK default gen_random_uuid()` | |
| `account_id` | `uuid NOT NULL FK→accounts.id` | |
| `movement_date` | `date NOT NULL` | |
| `kind` | `text NOT NULL CHECK (in ('opening','deposit','withdraw','transfer','trade','adjustment'))` | (`MOVEMENT_KINDS`) |
| `quantity` | `numeric NOT NULL` | Signed. Withdrawals/transfer-out/trade-out negative; deposits/openings/transfer-in/trade-in positive; adjustments take user-entered sign. |
| `group_id` | `uuid NULL` | Same value on both legs of a `transfer` or `trade`. |
| `notes` | `text NULL` | |
| `ortak_movement_type` | `text NULL CHECK (in ('partner_loan_in','partner_loan_out','profit_share') OR NULL)` | Required when the account's custody has `requires_movement_type=true` (the seeded "Ortak"). |
| `source_transaction_id` | `uuid NULL FK→transactions.id ON DELETE SET NULL` | Set when the movement was spawned by a `transactions` insert; null for standalone movements (openings, transfers, trades, manual adjustments). |
| audit | | |

Indexes: `account_id`, `group_id`, `movement_date`, `source_transaction_id`.

### 2.3 Foreign-Key Map (summary)

```
accounts.custody_location_id → custody_locations.id
contact_notes.contact_id → contacts.id
contacts.country_code → countries.code
loan_installments.loan_transaction_id → transactions.id (CASCADE)
order_details.order_id → orders.id (CASCADE)
order_details.product_id → products.product_id
order_details.supplier_id → contacts.id
orders.customer_id → contacts.id
orders.shipment_id → shipments.id
orders.billing_shipment_id → shipments.id
products.category_id → product_categories.id
products.default_supplier → contacts.id
real_estate_deals.contact_id → contacts.id
real_estate_installments.deal_id → real_estate_deals.id (CASCADE)
recurring_payments.account_id → accounts.id
recurring_payments.contact_id → contacts.id
recurring_payments.expense_type_id → expense_types.id
recurring_payment_occurrences.recurring_payment_id → recurring_payments.id (CASCADE)
recurring_payment_occurrences.transaction_id → transactions.id (SET NULL)
shipments.customer_id → contacts.id
transactions.contact_id → contacts.id
transactions.partner_id → partners.id
transactions.from_account_id → accounts.id
transactions.to_account_id → accounts.id
transactions.expense_type_id → expense_types.id
transactions.related_payable_id → transactions.id (SET NULL)
transactions.related_shipment_id → shipments.id (SET NULL)
transactions.psd_event_id → psd_events.id (CASCADE)
transactions.real_estate_deal_id → real_estate_deals.id
treasury_movements.account_id → accounts.id
treasury_movements.source_transaction_id → transactions.id (SET NULL)
app_settings.updated_by → auth.users(id)
monthly_fx_overrides.set_by → auth.users(id)
```

### 2.4 Storage Buckets

All buckets are private. URLs are generated as 1-hour signed URLs (`createSignedUrl(path, 3600)`).

| Bucket | Path convention | Allowed MIME types | Max size |
|---|---|---|---|
| `product-photos` | `{product_id}/{filename}` | `image/jpeg`, `image/png`, `image/webp` | 5 MB |
| `transaction-attachments` | `{transaction_id}/{filename}` | jpeg, png, webp, `application/pdf` | 5 MB |
| `order-attachments` | `{order_id}/{type}/{filename}` where `type ∈ {customer_po, proposal}` | jpeg, png, webp, pdf | 5 MB |
| `shipment-documents` | `{shipment_id}/{timestamp}.{ext}` (single file column — replace, not append) | jpeg, png, webp, pdf | 5 MB |
| `shipment-invoices` | `{shipment_id}/statement-{unix_timestamp}.pdf` | pdf | (n/a — system-generated) |

Bucket constants exported from `src/lib/constants.ts`: `PRODUCT_IMAGE_BUCKET`, `TRANSACTION_ATTACHMENT_BUCKET`, `ORDER_ATTACHMENT_BUCKET`, `SHIPMENT_DOCUMENTS_BUCKET`, `SHIPMENT_INVOICE_BUCKET`.

### 2.5 Seeded Data Summary

- **`countries`**: ~115 rows from `20260427140000_seed_countries.sql`.
- **`partners`**: 'Partner 1', 'Partner 2', 'Partner 3' (from foundation migration).
- **`expense_types`**: Marketing & Sales, Operations & Logistics, Subscriptions & Software, Professional Services, Office & General/Transit, Uncategorized.
- **`product_categories`**: Food & Beverage, Textiles & Apparel, Furniture & Home Goods, Electronics & Appliances, Machinery & Equipment, Construction & Building Materials, Personal Care & Cosmetics.
- **`app_settings`**: One row with the company letterhead.
- **`custody_locations`**: Existed prior to repo history — at least includes "Şirket", "Ortak" (with `requires_movement_type=true`), and "Kasa". Editable via Settings.

### 2.6 No Functions / Views / Enums

The generated `Database` type shows `Functions: never`, `Views: never`, `Enums: never`. All constraints are inline CHECKs; lookups come from real tables.

### 2.7 No Chart of Accounts

There is **no GL account hierarchy**. The application uses a simplified posting model:

- **Cash positions:** Tracked per `accounts` row (treasury balance = SUM(`treasury_movements.quantity`) per account).
- **Receivables / Payables:** Derived per contact by replaying `transactions` through pure ledger functions (`allocateFifo`, supplier-invoice diffing).
- **Revenue / Expense:** Derived per period by aggregating `transactions` whose `kind` falls into the P&L revenue/expense buckets (see Section 4).

There is no `gl_accounts` table, no posting groups, no closing entries.

---


## 3. Backend / API

There is **no traditional REST/GraphQL backend**. All data access happens via:

1. The **Supabase JS client** (`@supabase/supabase-js`) called from React Query `queryFn`/`mutationFn` in browser code.
2. The **server-side Supabase client** (`@supabase/ssr`) used only by the auth callback route, the signout route, and the auth-guard layout.
3. Two **route handlers** under `src/app/auth/` for OAuth callback and signout.
4. One **Deno edge function** under `supabase/functions/refresh-rates/` for FX/price refreshes (callable from cron and the manual button).

### 3.1 Route Handlers

#### `GET /auth/callback`

- **File:** `src/app/auth/callback/route.ts`
- **Purpose:** Exchange a magic-link code for a session.
- **Query params:** `code` (Supabase auth code), `next` (optional return path; default `/dashboard`).
- **Behavior:**
  1. If `code` is present, call `supabase.auth.exchangeCodeForSession(code)`.
  2. On success, redirect to `${origin}${next}`.
  3. On failure (no code or exchange error), redirect to `/login?error=auth_callback_failed`.

#### `POST /auth/signout`

- **File:** `src/app/auth/signout/route.ts`
- **Behavior:** Calls `supabase.auth.signOut()`, then `303` redirects to `/login`. Triggered by the sidebar "Sign out" form (HTML form with `action="/auth/signout" method="post"`).

### 3.2 Auth Proxy (`src/proxy.ts`)

Next 16's renamed middleware. Runs on every request matching:

```
/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)
```

Logic:
1. If `AUTH_DISABLED` (`NEXT_PUBLIC_DISABLE_AUTH=true`), pass through unchanged.
2. Else build a server Supabase client wired to request/response cookies (so it can refresh expired tokens transparently).
3. Call `supabase.auth.getUser()`.
4. `PUBLIC_PATHS = ['/login', '/auth/callback']`.
5. If no user and path is not public → `307` redirect to `/login?next=<original-path>`.
6. If user is authenticated and path is `/login` → redirect to `/dashboard`.
7. Otherwise pass through with refreshed cookies.

### 3.3 Edge Function: `refresh-rates`

- **Location:** `supabase/functions/refresh-rates/`
- **Files:** `index.ts` (Deno handler) and `refresh-engine.ts` (logic, mirrored from `src/features/treasury/refresh-engine.ts`).
- **Trigger:** Either pg_cron (`0 6 * * 1-5` UTC = 09:00 weekdays Istanbul) OR manual POST from the Treasury page.
- **Auth:** `verify_jwt = true` (default). pg_cron passes `Authorization: Bearer <service_role_key>` from Vault.
- **Body:** Empty JSON `{}`.
- **Behavior:**
  1. Build a Supabase server client with `SERVICE_ROLE_KEY`.
  2. Run `refreshFxSnapshots(client)` and `refreshPriceSnapshots(client)` in parallel via `Promise.allSettled`.
  3. Insert one row to `rate_refresh_runs` capturing both outcomes (and any combined error message).
  4. Return HTTP 200 with the combined outcome JSON: `{ fx: { inserted, skipped: string[], errors: string[] }, price: {...} }`.

#### Refresh engine sub-routines

- **`refreshFxSnapshots(client)`**:
  - Query `accounts.asset_code` for all distinct fiat codes in use (asset_type = 'fiat').
  - Always insert USD with `rate_to_usd = 1`.
  - For each non-USD code, fetch `https://api.frankfurter.dev/v1/latest?from={code}&to=USD`, extract `rates.USD`. Validate > 0 and finite.
  - Upsert `(currency_code, snapshot_date, source='frankfurter.dev')` into `fx_snapshots`.
  - Return `{ inserted, skipped, errors }`.

- **`refreshPriceSnapshots(client)`**:
  - Query distinct asset codes from accounts where asset_type IN ('crypto','metal').
  - For crypto codes, look up CoinPaprika ID in hardcoded `COINPAPRIKA_IDS` map (~20 entries: BTC, ETH, USDT, USDC, AVAX, BNB, SOL, XRP, ADA, DOGE, MATIC, DOT, TRX, LINK, LTC, BCH, ATOM, SHIB, XLM, NEAR). Fetch `https://api.coinpaprika.com/v1/tickers/{id}`, extract `quotes.USD.price`.
  - For metals, look up `METAL_ASSET_MAP` (XAU/XAG → oz; GOLD/SILVER → oz; Altın/Altın(gr)/Gümüş/Gümüş(gr) → gram). Fetch `https://api.gold-api.com/price/{metal}`. If unit is gram, divide oz price by `OZ_TO_GRAM = 31.1034768`.
  - Upsert `(asset_code, snapshot_date, source)` into `price_snapshots`.
  - Codes not in the maps are returned in `skipped`.

- **`logRefreshRun(client, triggeredBy, fx, price)`**: Inserts row to `rate_refresh_runs`, normalizes both settled results into the JSON shape, captures combined error if either was rejected. Tolerates own logging errors.

### 3.4 Browser-side Query/Mutation Catalog

Each module under `src/features/<module>/` exports `queries.ts` and `mutations.ts` (sometimes split into `mutations/<sub>.ts`). Functions are called from React components via `@tanstack/react-query` with module-scoped key factories.

Below is the catalog. `Promise<...>` shapes are paraphrased — the canonical type is the function return.

#### 3.4.1 Treasury (`src/features/treasury/`)

**Query keys (`treasuryKeys`):** `all`, `accounts()`, `movements()`, `custody()`, `fx()`, `prices()`, `refreshRuns()`.

**Queries (`queries.ts`):**

| Function | Returns | Notes |
|---|---|---|
| `listAccountsWithCustody()` | `AccountWithCustody[]` | `SELECT *, custody_locations(...) FROM accounts WHERE deleted_at IS NULL AND is_active = true ORDER BY account_name`. Picker-grade list. |
| `listAllMovements()` | `TreasuryMovement[]` | All movements ordered by `movement_date DESC, created_time DESC`. |
| `listCustodyLocations({ activeOnly })` | `CustodyLocation[]` | Sorted by `name ASC`. |
| `listFxSnapshots()` | `FxSnapshot[]` | Sorted by `fetched_at DESC`. |
| `listPriceSnapshots()` | `PriceSnapshot[]` | Sorted by `snapshot_date DESC`. |
| `fetchLastRefreshRun()` / `useLastRefreshRun()` | `RateRefreshRun \| null` | Most recent refresh. Tolerates table-missing errors silently (returns null). |
| `computeBalanceMap(movements)` | `Map<account_id, balance>` | Pure helper. SUM(quantity) per account. |
| `latestByKey(rows, keyFn, sortTsFn)` | `Map<key, row>` | Pure helper for "newest snapshot per asset". |

**Mutations (`mutations.ts`):**

| Function | Args | Behavior |
|---|---|---|
| `currentUserId()` | — | Returns `auth.users(id)` of the signed-in user, or `null` when `AUTH_DISABLED`. Throws `"Not authenticated"` otherwise. |
| `signedQuantityFor(kind, q)` | `MovementKind, number` | Pure: `withdraw → -|q|`; `deposit/opening → +|q|`; otherwise `q` as-is. |
| `createAccountWithOpening({ account_name, asset_code, asset_type, custody_location_id, quantity, movement_date, notes?, ortak_movement_type? })` | | 1) Generate UUID. 2) Insert `accounts` row. 3) Insert `treasury_movements` row of `kind='opening'` with positive quantity. 4) On step 3 failure, delete the account (rollback). |
| `createSingleLegMovement({ account_id, kind ∈ {opening,deposit,withdraw,adjustment}, quantity, movement_date, notes?, ortak_movement_type? })` | | Single insert into `treasury_movements`. |
| `createPairedMovement({ kind ∈ {transfer,trade}, from_account_id, to_account_id, quantity_from, quantity_to, movement_date, notes?, ortak_movement_type? })` | | Generate `group_id` UUID. **Transfer guard:** fetch both accounts; require matching `asset_code` AND matching abs quantities; else throw `"Transfer requires matching currencies — from holds X, to holds Y. Use a trade for cross-asset moves."` or `"Transfer quantities must match (same asset)."`. Insert two rows with same `group_id` and opposite-signed quantities. |

**Constants (`constants.ts`):**

- `FX_STALE_MS = 24 * 60 * 60 * 1000`
- `FX_API_BASE = "https://api.frankfurter.dev/v1"`, `FX_SOURCE = "frankfurter.dev"`
- `COINPAPRIKA_API`, `COINPAPRIKA_SOURCE`, `GOLD_API_BASE`, `GOLD_API_SOURCE`
- `COINPAPRIKA_IDS` map (20 entries: BTC, ETH, USDT, USDC, AVAX, BNB, SOL, XRP, ADA, DOGE, MATIC, DOT, TRX, LINK, LTC, BCH, ATOM, SHIB, XLM, NEAR)
- `METAL_ASSET_MAP` (XAU/XAG/GOLD/SILVER → oz; Altın/Altın(gr)/Gümüş/Gümüş(gr) → gram)
- `OZ_TO_GRAM = 31.1034768`
- `MOVEMENT_KIND_LABELS`: `opening: "Opening balance"`, `deposit: "Deposit"`, `withdraw: "Withdraw"`, `transfer: "Transfer"`, `trade: "Trade"`, `adjustment: "Adjustment"`
- `MOVEMENT_KIND_DESCRIPTIONS`: e.g. `transfer: "Move the same asset between two custody locations."`
- `SINGLE_LEG_KINDS = ['opening','deposit','withdraw','adjustment']`
- `PAIRED_KINDS = ['transfer','trade']`
- `RECORDABLE_MOVEMENT_KINDS = ['opening','transfer','trade','adjustment']` — `deposit`/`withdraw` are *only* spawned by the Transactions page (never recorded directly).
- `ORTAK_TYPE_LABELS`: `partner_loan_in: "Partner loan in"`, `partner_loan_out: "Partner loan out"`, `profit_share: "Profit share"`
- `ASSET_TYPE_LABELS`: `fiat: "Fiat"`, `credit_card: "Credit card"`, `crypto: "Crypto"`, `metal: "Metal"`, `fund: "Fund"`

**Schema (`schema.ts`):**

- `addHoldingSchema` (Zod): `account_name` required, `asset_code` required, `asset_type` enum, `custody_location_id` required ("Pick a custody location"), `custody_requires_movement_type` boolean, `quantity` positive number ("Opening quantity must be positive"), `movement_date` `YYYY-MM-DD` regex ("Pick a date"), `ortak_movement_type` optional. `superRefine`: requires `ortak_movement_type` when `custody_requires_movement_type=true`, message `"Required for this custody"`.
- `movementSchema` (Zod discriminated union on `kind`): one variant per `MovementKind`. Common fields: `movement_date`, `notes`, `ortak_movement_type`, `any_leg_requires_movement_type`. Variant-specific:
  - `opening`/`deposit`/`withdraw`: `account_id`, `quantity` positive
  - `adjustment`: `account_id`, `quantity` signed-non-zero (`"Cannot be zero"`)
  - `transfer`/`trade`: `from_account_id`, `to_account_id`, asset codes, quantities. Cross-checks: `from ≠ to` (`"Pick a different destination"`), transfer requires matching assets (`"Transfer requires the same asset on both sides"`), trade requires different assets (`"Trade requires different assets on each side"`). `ortak_movement_type` required when `any_leg_requires_movement_type=true` (`"Required when Ortak is involved"`).

**Refresh engine (`refresh-engine.ts`):**

Browser-side mirror of the edge function. Exposed via `useRefreshRatesMutation()` (called from the "Refresh rates" button). Same algorithm; logs `triggered_by='manual'` to `rate_refresh_runs`.

#### 3.4.2 Accounts (`src/features/accounts/`)

**Queries (`queries.ts`):**

| Function | Returns | Notes |
|---|---|---|
| `listAccountsForRegistry()` | `AccountWithCustody[]` | All non-deleted accounts (including inactive), with `custody_locations` joined. |
| `getAccount(id)` | `AccountWithCustody \| null` | Single fetch. |
| `listMovementsForAccount(accountId)` | `TreasuryMovement[]` | Account-specific movements, ordered by date. |

**Mutations (`mutations.ts`):**

| Function | Behavior |
|---|---|
| `createAccount(values)` | Insert into `accounts`. (Opening balance happens via separate "Add holding" flow in treasury.) |
| `updateAccount(id, values)` | Update `accounts` row. |
| `deactivateAccount(id)` | Sets `is_active=false`. |
| `reactivateAccount(id)` | Sets `is_active=true`. |
| `softDeleteAccount(id)` | Sets `deleted_at=now()`. |

**Schema (`schema.ts`):**

`accountFormSchema`: `account_name` (required, case-insensitive unique), `asset_code` (required), `asset_type` (enum), `custody_location_id` (required), optional `bank_name`, `iban`, `subtype`, `shares`.

#### 3.4.3 Transactions (`src/features/transactions/`)

**Queries (`queries.ts`):**

| Function | Returns / Behavior |
|---|---|
| `listTransactions({ filters })` | Paginated list. Joins `contacts`, `partners`, `from_account`, `to_account`, `expense_types`, `psd_events`. |
| `getTransaction(id)` | Single transaction with joins. |
| `listTransactionsForContact(contactId, currency)` | Used by `LedgerSection`. Selects ledger-relevant kinds, joins `shipments` for `related_shipment_id` (now possible since the FK exists). |
| `listTransactionsForPartner(partnerId)` | Joined with accounts and PSD context. |
| `listTransactionsForShipment(shipmentId)` | Used by Shipments detail (billing breakdown). |
| `listSupplierInvoicesForContact(contactId)` | Open invoices for the supplier-payment "link to invoice" combobox. |
| `listSupplierPaymentsForInvoice(invoiceId)` | Reverse lookup. |
| `transactionAttachmentSignedUrl(path, expiresInSec?, downloadFilename?)` | Signed URL from `transaction-attachments` bucket. |

**Mutations (`mutations.ts`):**

| Function | Behavior |
|---|---|
| `createTransaction({ payload, pendingFile? })` | 1) Insert `transactions` row with all common + kind-specific fields. 2) If `pendingFile`, upload to `transaction-attachments/{txn_id}/...`, then update row with the path. 3) Call `spawnMovementFromTransaction(txn)` for cash-flow kinds. 4) On any failure after txn insert, delete the row + remove uploaded file (rollback). |
| `updateTransaction({ id, payload, pendingFile?, removeAttachment?, previousAttachmentPath? })` | Mirror of create with attachment lifecycle handling and movement re-spawn. |
| `deleteTransaction(id)` | Cascades movements via FK SET NULL; also explicitly removes movements where `source_transaction_id = id`. Removes attachment from storage. |
| `spawnMovementFromTransaction(txn)` | Pure routing function (in-mutation helper). Looks up `KIND_SPAWN_DIRECTION[kind]`. If `deposit` and `to_account_id` set → insert `treasury_movements(kind='deposit', quantity=+amount, source_transaction_id=txn.id)`. If `withdraw` and `from_account_id` set → insert with negative quantity. Skips otherwise (accruals, partner-paid expenses). |

**Constants (`constants.ts`):**

- `TRANSACTION_KIND_LABELS`: see Section 4.1.
- `TRANSACTION_KIND_DESCRIPTIONS`: short subtitles for picker.
- `TRANSACTION_KIND_BADGE_CLASSES`: Tailwind classes per kind.
- `DISABLED_KIND_REASONS`: e.g. `shipment_billing: "Created automatically when a shipment is booked. Manage from the shipment detail page."`, `profit_distribution: "Recorded from the Partners page using the profit-distribution dialog."`.
- `CASH_IN_KINDS`: `client_payment, other_income, partner_loan_in`.
- `CASH_OUT_KINDS`: `client_refund, supplier_payment, expense, partner_loan_out, profit_distribution, tax_payment`.
- `ACCRUAL_KINDS`: `supplier_invoice, shipment_billing, shipment_cogs, shipment_freight`.
- `KIND_SPAWN_DIRECTION` map: `client_payment→deposit`, `client_refund→withdraw`, `supplier_payment→withdraw`, `expense→withdraw`, `other_income→deposit`, `partner_loan_in→deposit`, `partner_loan_out→withdraw`, `profit_distribution→withdraw`, `tax_payment→withdraw`. Accrual kinds and `expense` paid-by-partner are absent (no movement spawned).
- `kindSpawnsMovement(kind, hasFromAccount, hasToAccount)`: predicate.
- `KIND_CATEGORIES`: 3-level picker tree:
  - "Money in" (`in`) → kinds: client_payment, other_income, partner_loan_in
  - "Money out" (`out`) → subCategories:
    - "Operating": supplier_payment, expense, client_refund, tax_payment
    - "Partner": partner_loan_out, profit_distribution
  - "Bills (accruals)" (`bills`) → kinds: supplier_invoice, shipment_billing, shipment_cogs, shipment_freight
- `locateKind(k)`: returns `{ category, sub | null }`.

**Schema (`schema.ts`):** `transactionSchema` is a discriminated union over `kind`. Common fields on every variant: `transaction_date` (`/^\d{4}-\d{2}-\d{2}$/`, error `"Pick a date"`), `amount` (positive, `"Amount must be positive"`), `currency` (enum BALANCE_CURRENCIES), `description` (optional default ""), `reference_number` (optional default ""). Per-variant requirements (verbatim error messages):

- `client_payment`: `contact_id` (`"Pick a customer"`), `to_account_id` (`"Pick a destination account"`), optional `fx_rate_applied`, `fx_target_currency`, `fx_converted_amount`, `real_estate_deal_id`. **superRefine:** if `contact_balance_currency` set AND ≠ `currency`, `fx_rate_applied` is required (`"FX rate required when currency differs from client balance"`).
- `client_refund`: `contact_id`, `from_account_id`.
- `expense`: `expense_type_id` (`"Pick an expense type"`), optional `contact_id`, `paid_by` ∈ `{business, partner}`, `from_account_id` / `partner_id` per `paid_by`, `vat_rate` (must be one of `KDV_RATES = [0,1,10,20]`, else `"Pick a valid VAT rate"`), optional `vat_amount`, `net_amount`. **superRefine:** business → require `from_account_id` (`"Pick a source account"`), forbid `partner_id`/`contact_id`. Partner → require `partner_id` (`"Pick a partner"`), forbid `from_account_id`/`contact_id`.
- `other_income`: `to_account_id`.
- `supplier_invoice`: `contact_id` (`"Pick a supplier"`), optional VAT trio. **superRefine:** `reference_number` required (`"Invoice number is required"`).
- `supplier_payment`: `contact_id`, `from_account_id`, optional `related_payable_id`.
- `partner_loan_in`: `partner_id` (`"Pick a partner"`), `to_account_id`.
- `partner_loan_out`: `partner_id`, `from_account_id`.
- `profit_distribution`: `from_account_id` only (no `partner_id`).
- `tax_payment`: `from_account_id`, optional `kdv_period` (`/^\d{4}-(0[1-9]|1[0-2])$/`, `"Use YYYY-MM"`).

#### 3.4.4 Contacts (`src/features/contacts/`)

**Queries:**

| Function | Returns / Behavior |
|---|---|
| `listContacts()` | Active contacts (`deleted_at IS NULL`), with `countries(code, name_en, flag_emoji)` joined. |
| `listDeletedContacts()` | Archived view, ordered by `deleted_at DESC`. |
| `getContact(id)` | Single active contact with country. |
| `listCountries()` | All countries, ordered by `name_en ASC`. |
| `listContactBalances()` | For each contact with `balance_currency`: fetch transactions in relevant kinds. For supplier-like (`type ∈ {supplier, logistics}`): net = Σ(supplier_invoice) − Σ(supplier_payment) in `balance_currency`. For customer-like: run `allocateFifo` on `[shipment_billing, client_payment, client_refund]`. Returns `ContactBalance` rows with `{ contact_id, net_balance, currency, has_transactions, has_skipped }`. |
| `listContactNotes(contactId)` | `ORDER BY note_date DESC, created_time DESC`. |

**Mutations:**

- `createContact(values)`, `updateContact(id, values)`: insert/update. Helper `toPayload()` strips empty strings to null, trims, and only keeps `tax_office` when country is TR.
- `deleteContact(id)`: `UPDATE contacts SET deleted_at=now()` (soft).
- `restoreContact(id)`: `UPDATE contacts SET deleted_at=NULL`.
- `addContactNote(contactId, values)`: insert into `contact_notes`.

**Schema:**

- `contactFormSchema`: `company_name` (trimmed, required), `contact_person` optional, `type` enum (required, `"Type is required"`), `phone` optional, `email` optional regex `^[^\s@]+@[^\s@]+\.[^\s@]+$` (`"Invalid email"`), `address`, `city`, `country_code` optional, `balance_currency` enum-or-empty, `tax_id`, `tax_office`, `notes`.
- `contactNoteFormSchema`: `note_date` required (`"Date is required"`, `"Invalid date"`), `body` required (`"Note cannot be empty"`).

#### 3.4.5 Partners (`src/features/partners/`)

**Queries (`queries.ts` + `queries/*.ts`):**

| Function | Behavior |
|---|---|
| `listPartnersWithStats()` | All partners with txn counts, last activity, status. |
| `getPartner(id)` | Single partner. |
| `listTransactionsForPartner(partnerId)` (`queries/partner-transactions.ts`) | All transactions tied to partner via `partner_id` OR PSD legs (filtered through join), with account joins. |
| `listPartnersWithPendingReimbursements()` (`queries/pending-reimbursements.ts`) | Returns partners whose expense claims (kind=expense, `partner_id` set, `from_account_id IS NULL`) are not fully settled by `partner_loan_out` (with `is_loan=false`) payouts. Uses `allocatePartnerReimbursementFifo` per currency. |
| `partnerReimbursementSummary(partnerId)` (`queries/partner-reimbursement-summary.ts`) | Per-partner aggregate by currency. |
| `useLoansSummary()` (`queries/loans.ts`) | All `is_loan=true` `partner_loan_out` rows + their `loan_installments`, with paid-amount derivation. Returns outstanding-by-currency aggregate. |
| `usePsdSummary({ yearFrom, yearTo })` (`queries/psd-summary.ts`) | Aggregates PSD legs per (year, month, currency) for the calendar view. |
| `usePsdEvents({ yearFrom, yearTo })` | Full PSD event records with leg details. |

**Mutations (`mutations.ts` + `mutations/*.ts`):**

- `createPartner({ name })`, `renamePartner(id, { name })`, `setPartnerActive(id, isActive)`, `softDeletePartner(id)`, `restorePartner(id)`.
- `mutations/loans.ts`:
  - `createLoanWithInstallments({ partner_id, date, currency, source_account_id, amount, note?, installments[] })`: 1) Insert `transactions` with `kind='partner_loan_out'`, `is_loan=true`. 2) Spawn `treasury_movements` (`kind='withdraw'`). 3) Insert `loan_installments` rows in batch. Rollback all on failure.
  - `updateLoan(id, payload)`, `deleteLoan(id)` (cascades installments via FK; reverses movement).
  - `recordLoanRepayment({ partner_id, date, currency, destination_account_id, amount, note? })`: Creates `transactions` `kind='partner_loan_in'`, `is_loan=true`, with `to_account_id` (no credit cards allowed). Spawns `deposit` movement.
- `mutations/psd-events.ts`:
  - `createPsdEvent({ event_date, fiscal_period?, note?, legs[] })`: 1) Insert `psd_events`. 2) For each leg, insert `transactions` `kind='profit_distribution'`, `psd_event_id` set, `partner_id=null`, `from_account_id` per leg, currency per leg. 3) Spawn `withdraw` movement per leg. Rollback on any failure.
  - `updatePsdEvent(id, ...)`, `deletePsdEvent(id)` (cascades leg transactions and reverses movements).

**Schema (`schema.ts`):** `partnerFormSchema`: `name` trimmed, required (`"Name is required"`), max 100 (`"Name is too long"`).

#### 3.4.6 Real Estate (`src/features/real-estate/`)

**Queries:**

| Function | Behavior |
|---|---|
| `listDealsWithAllocations()` | All non-deleted `real_estate_deals`, plus their `real_estate_installments` and `transactions` where `real_estate_deal_id = deal.id`. Computes installment status via `allocateInstallments(installments, payments, today)`. |
| `getDeal(id)` | Single deal + installments + payments. |
| `listInstallmentsDueWindow({ from, to })` | Pending receipts strip — installments due in window across all deals. |

**Mutations:**

- `createDealWithSchedule({ deal: {...}, installments: [...] })`: Insert `real_estate_deals`, then `real_estate_installments` in batch.
- `updateDeal(id, payload)`, `softDeleteDeal(id)`.
- `replaceInstallments(dealId, installments)`: Delete + re-insert.
- `recordReceipt({ deal_id, date, currency, to_account_id, amount, description? })`: Insert `transactions` `kind='client_payment'`, `real_estate_deal_id=deal_id`, `contact_id=deal.contact_id`. Spawn `deposit` movement. (FIFO consumption of installments is computed at read-time.)

**Schema:** `dealFormSchema` (label required + case-insensitive unique check, sub_type rent/sale, contact_id required, currency enum, start_date required, optional notes, installment array each with due_date + expected_amount > 0). `receiptFormSchema` (date, account, currency, amount required).

#### 3.4.7 Orders (`src/features/orders/`)

**Queries (`queries.ts`):**

See Orders agent report — same content. Key entries:
- `listOrders()` returns `OrderWithRelations[]` with computed `line_count`. Joins customer summary, shipment summary, and `order_details(id, line_number, quantity, unit_sales_price, vat_rate)`. Ordered `order_date DESC, created_time DESC`.
- `getOrder(id)` single.
- `listOrderDetails(orderId)` joins `supplier(id, company_name)`. Order by `line_number ASC`.
- `listCustomerContacts()` `type='customer'` summaries.
- `listAssignableOrdersForShipment(shipmentId, customerId)` filters: same customer, `shipment_id IS NULL`, status IN `('accepted','in_production')`.
- `listOrdersForProduct(productId)` joins details to orders.
- `orderAttachmentSignedUrl(path, expiresInSec?, downloadFilename?)` 1-hour signed URL.

**Mutations:** see Section 3.4.7 below for full exhaustive Orders detail (`createOrder`, `updateOrder`, `advanceOrderStatus`, `cancelOrder`, `addOrderLine`, `updateOrderLine`, `deleteOrderLine`, `assignOrderToShipment`, `unassignOrderFromShipment`, `updateOrderProformaMetadata`, `setOrderOfferNumber`, `batchAddLinesFromProforma`).

Key validation/business rules in mutations:

- `advanceOrderStatus`: validates via `NEXT_ORDER_STATUS`. **Gate inquiry → quoted:** ≥1 line AND every line has `unit_sales_price > 0` AND `offer_date`/`incoterm`/`payment_terms` filled. **Gate in_production → shipped:** order has `shipment_id` AND shipment status ≠ `'draft'`.
- `cancelOrder`: requires `reason.trim().length ≥ 1` (Zod `min(3)`). Rejects if status is in `TERMINAL_ORDER_STATUSES`. Detaches both `shipment_id` and `billing_shipment_id`. Stamps `cancelled_at`, `cancellation_reason`. Calls `refreshShipmentBilling` on previous billing shipment.
- `addOrderLine`: computes next `line_number` via MAX query; race retries once on unique-conflict. Triggers `refreshShipmentBilling` if order has `billing_shipment_id`.
- `updateOrderLine`/`deleteOrderLine`: same billing refresh; rolls back on refresh error.
- `assignOrderToShipment`: defaults `billing_shipment_id` to `shipment_id` if not provided (or keeps if already set).
- `unassignOrderFromShipment`: only clears `shipment_id`, leaves `billing_shipment_id`.
- `updateOrderProformaMetadata`: auto-generates `offer_number` via `generateOfferNumber(supabase, offer_date)` if not set.
- `setOrderOfferNumber`: manual override; pass `null` to clear.

#### 3.4.8 Shipments (`src/features/shipments/`)

**Queries:**

| Function | Behavior |
|---|---|
| `listShipments()` | Returns `ShipmentListRow[]` with customer + nested orders + `order_details` with product snapshots, computed `total_cbm`, `total_weight_kg`, `order_count`. |
| `getShipment(id)` | Single shipment. |
| `listDraftShipmentsForCustomer(customerId)` | Filter `status IN ('draft','booked')` for assignment dropdown. |
| `countShipmentsForCustomer(customerId)` | For default-name generation ("Shipment #N"). |
| `previewShipmentCascade(shipmentId, nextStatus)` | Returns the orders + lines that would have accruals created if advancing. |
| `shipmentDocumentSignedUrl(path, expiresInSec?)` | Signed URL from `shipment-documents` or `shipment-invoices`. |

**Mutations:**

- `createShipment({ payload })`, `updateShipment({ id, payload })`.
- `advanceShipmentStatus({ shipment_id, to })`: validates via `NEXT_SHIPMENT_STATUS`. **On `draft → booked`:** for each assigned order, create three transactions: `shipment_billing` (sum of qty × `unit_sales_price` over lines), `shipment_cogs` (sum of qty × `est_purchase_unit_price`), `shipment_freight` (allocated portion of `freight_cost`). Then call `refreshShipmentBilling(shipment_id)`. **`booked → in_transit`:** also cascades all linked orders from `accepted`/`in_production` to `shipped` (gated on no orders being still `inquiry`/`quoted`). **`in_transit → arrived`:** metadata-only, no order cascade, no billing refresh.
- `refreshShipmentBilling(shipmentId)` (`billing.ts`): Recomputes `shipment_billing` and `shipment_cogs` totals from `order_details`. Updates the existing billing transaction in place. Idempotent thanks to `uniq_shipment_accrual` index.
- `uploadShipmentDocument(file, shipmentId)` (`documents.ts`): upload + update `shipments.documents_file`.

#### 3.4.9 Products (`src/features/products/`)

**Queries:**

- `listProducts()`: with `product_categories(id, name)`, `supplier(id, company_name)`. Filtered to `deleted_at IS NULL`. Ordered by `product_name ASC`.
- `getProduct(id)`, `listProductCategories()`, `listSupplierContacts()` (suppliers only).
- `productImageUrl(path)`: public URL from `product-photos`.
- `listOrdersForProduct(productId)` (in `orders/queries.ts`).

**Mutations:**

- `createProduct(values, productId)`, `updateProduct(productId, values)`, `deleteProduct(productId)` (soft delete via `deleted_at`).
- `uploadProductImage(file, productId)`: upload + return path. The product UUID is generated client-side so the upload path can be `{product_id}/...` before the row exists.
- `batchAddProductsFromImport(...)`: parse JSON, insert all into `products`. Rollback all if any fail.

**Schema:** `productFormSchema`: trimmed strings; `kdv_rate` enum `KDV_RATES`; `packaging_type` enum or null; numeric fields with `min(0)`. Form snapshots dimension fields; if `packaging_type` is not set, package_*_cm are cleared on save.

#### 3.4.10 Profit-Loss (`src/features/profit-loss/`)

**Queries (`queries.ts`):**

| Function | Returns |
|---|---|
| `useMonthlyPandL(period)` | `MonthlyPandL` — calls `aggregateMonthlyTotals`. |
| `aggregateMonthlyTotals(period, transactions, snapshots, overrides)` | `{ totals, rate, hasMissingRate }`. Filters `transactions` to `istanbulYearMonth(date) === period`, classifies revenue (`shipment_billing`, `other_income`, `client_payment` with `real_estate_deal_id`) vs expense (`expense`, `shipment_cogs`, `shipment_freight`). Converts non-USD amounts to USD via resolved rate; non-TRY/USD currencies marked `hasUnconverted`. |
| `resolveMonthlyRate(period, currency, overrides, snapshots)` | Priority: **(1)** matching `monthly_fx_overrides` row → `source: "override"`. **(2)** Latest `fx_snapshots` row in same period → `source: "snapshot"`, `stale: false`. **(3)** Latest snapshot before/at period → `stale: true`. **(4)** None → `{ value: null, source: "missing" }`. `displayPerUsd = 1 / rate_to_usd`. |
| `useNetPandLTrend(periods=12, anchor?)` | Last 12-month trailing trend. `netUsd: number \| null` per month (null = missing rate or unconverted currency). |
| `useNetPandLTrendBuckets(buckets)` | Sums months per bucket; null if any constituent month has missing rate. |
| `usePeriodTotals(periods)` | For multi-period view: returns Map of period→Totals + missing-rate set. |
| `listMonthlyFxOverrides()` | All overrides ordered `period DESC`. |

**Mutations (`mutations.ts`):**

| Function | Behavior |
|---|---|
| `upsertMonthlyFxOverride({ period, currencyCode, ratePerUsd, note? })` | Validates `ratePerUsd > 0`. Stores `rate_to_usd = 1 / ratePerUsd`. Sets `set_at = now()`, `set_by = userId`. Upserts on `(period, currency_code)`. |
| `deleteMonthlyFxOverride(period, currencyCode)` | DELETE matching row. |

**Period helpers (`period-helpers.ts`):**

- `Quarter = 1|2|3|4`, `PeriodBucket = { key, label, months: string[], isInProgress }`.
- `monthsInQuarter(year, quarter)` → `["YYYY-01", "YYYY-02", "YYYY-03"]` for Q1, etc.
- `monthsInYear(year)` → 12 entries.
- `currentYear()`, `currentQuarter()`, `quartersOfYear(year)` (4 buckets, `isInProgress` on current), `trailingYears(count)`, `selectableYears(count)`.

#### 3.4.11 Tax (KDV) (`src/features/tax/`)

**Queries:**

- `listKdvWindow(monthsBack=12, now)`: Filters transactions to `transaction_date ≥ windowStart`, kind in `WINDOW_KINDS = [VAT_COLLECTED_KINDS, VAT_PAID_KINDS, "tax_payment"]`. Joins `contacts` and `partners`. Ordered `transaction_date DESC, id DESC`.
- `windowStartIso(monthsBack, now)` returns `YYYY-MM-01`.

**CSV (`csv.ts`):**

- `buildKdvCsv(rows, period)`: builds Turkish-locale CSV with `;` separator and UTF-8 BOM. Header block includes `KDV Beyannamesi`, `Dönem`, `Hazırlanma tarihi`, `İşlenen satır`, `Atlanan satır (TRY dışı veya KDV yok)`. Column headers (Turkish): `Tarih | İşlem türü | Yön | Karşı taraf | Belge no | Açıklama | Para birimi | Matrah (Net) | KDV oranı | KDV tutarı`. Footer totals: `Toplam tahsil edilen KDV`, `Toplam ödenen KDV`, `Net ödenecek / devreden KDV`. Uses `Tahsil edilen` / `Ödenen` for direction. RFC 4180 quoting.
- `downloadCsv(filename, csv)` triggers browser download with the BOM-prefixed Blob.
- Filename format: `KDV_{period}_TurcGlobal.csv`.

#### 3.4.12 Recurring Payments (`src/features/recurring-payments/`)

**Queries:**

- `listMonthlyOccurrences(year, month)`: Active templates overlapping the month (`effective_from ≤ last_of_month AND (end_date IS NULL OR end_date ≥ first_of_month)`). For each, returns `{ template, occurrence }` where `occurrence` is the row from `recurring_payment_occurrences` for that period (or `null` = pending).
- `listTemplateHistory(templateId)`: All occurrences newest first, with linked transaction details.
- `pendingCountForMonth(year, month)`: count where `occurrence === null`.
- `effectiveDayForMonth(dayOfMonth, year, month)`: clamps to last day (e.g. 31 → 28/29 in Feb).

**Mutations:**

- `createRecurringTemplate(values)`, `updateRecurringTemplate(id, values)`, `setTemplateStatus(id, status)`, `softDeleteTemplate(id)`.
- `markOccurrencePaid({ template_id, year, month, paid_amount, paid_date, notes? })`: 1) Fetch template. 2) Build transaction (`description = "{name} — {Month Year}"`, kind from template, currency, account, contact, expense_type). 3) Insert transaction. 4) Call `spawnMovementFromTransaction`. 5) On spawn failure → delete txn (rollback). 6) Insert `recurring_payment_occurrences` row with `transaction_id`. 7) On occurrence insert failure → delete movement + transaction.
- `skipOccurrence({ template_id, year, month, notes? })`: insert occurrence with `status='skipped'`, no transaction.
- `undoOccurrence(occurrence_id)`: delete occurrence; if it had `transaction_id`, also delete the transaction (which cascades the movement).

**Schema:** `recurringPaymentFormSchema` — `name` required ("Name is required"), `kind` enum (`expense|supplier_payment|tax_payment`), `expected_amount` positive ("Amount must be positive"), `currency` enum, `day_of_month` int 1–31 ("Pick a day", "Whole number", "1–31"), `account_id` required (with currency-vs-account asset validation: `"Currency must match the account's asset (X)."`), `effective_from` date ("Pick a date"), optional `end_date` (validates `end_date ≥ effective_from`, `"End date can't be before the start."`), optional notes.

#### 3.4.13 Settings (`src/features/settings/`)

**Queries:**

- `getAppSettings()`: SELECT singleton row.
- `listCustodyLocations({ activeOnly })`: same as treasury query.

**Mutations:**

- `updateAppSettings(values)`: UPDATE on `id=true` with all fields + `updated_time=now()`, `updated_by=userId`.
- `createCustodyLocation(values)`, `updateCustodyLocation(id, values)`, `setCustodyLocationActive(id, isActive)`.

**Schema:**

- `appSettingsFormSchema`: `company_name`, `address_line1`, `address_line2`, `phone`, `email` all required, max 200. Email regex. Errors: `"Company name is required"`, `"Max 200 characters"`, `"Doesn't look like an email"`.
- `custodyLocationFormSchema`: `name` required max 80, `location_type` enum, `requires_movement_type` boolean.

#### 3.4.14 Dashboard (`src/features/dashboard/`)

**Queries:**

- `useArOutstanding()`: Fetches all shipments → unique customer_ids → fans out per-customer ledger queries → runs `allocateFifo` per (customer, currency) → filters to shipments with `status ≠ 'arrived'` → sums by currency.
- `usePendingReimbursementsAggregate()`: see Partners.
- Treasury, FX/price snapshots, last refresh queried via shared treasury queries.

**Attention rules (`attention-rules.ts`):**

| Rule | Severity | Trigger |
|---|---|---|
| `shipmentEtaPastDueRule` | red | `status === 'in_transit' AND eta_date < today` |
| `kdvUnfiledRule` | red | Period not current month, not filed, non-zero net VAT, today past 26th of M+1 (Beyanname deadline) |
| `oldPartnerReimbursementRule` | amber | Pending reimbursement claim older than 30 days (`REIMBURSEMENT_AGE_DAYS = 30`) |
| `realEstateOverdueRule` | red | Installment `due_date < today` AND days overdue > 7 |

Sort: red first, then amber; stable id order within bucket.

### 3.5 External Services Called

See Section 9 (Integrations). Summary:
- Frankfurter (`api.frankfurter.dev`) for fiat→USD rates
- CoinPaprika (`api.coinpaprika.com`) for crypto prices
- gold-api.com (`api.gold-api.com`) for gold/silver oz prices
- Supabase Storage for files
- Supabase Auth for magic-link sign-in
- Supabase Postgres via `@supabase/supabase-js`


---

## 4. Accounting & Business Logic (Deep Dive)

### 4.1 Transaction-Kind Taxonomy

Every cash-flow and accrual flows through `transactions.kind`. Allowed values (from the latest CHECK):

```
client_payment       — Cash received from a customer (deposit movement; FIFO-allocates against shipment_billing).
client_refund        — Cash returned to a customer (withdraw movement).
supplier_payment     — Cash paid to a supplier (withdraw movement). Optional related_payable_id.
supplier_invoice     — Accrual; invoice booked but unpaid. No movement spawn. VAT trio captured.
expense              — Operating expense. Either business-paid (withdraw movement, from_account_id required) or partner-paid (no movement, partner_id required, becomes a reimbursable claim).
other_income         — Non-operating income (deposit movement).
partner_loan_in      — Money the partner lends to the business (deposit movement).
partner_loan_out     — Either a loan from the business to a partner (is_loan=true, with installments) OR a reimbursement payout to the partner (is_loan=false, settles claims).
profit_distribution  — Leg of a PSD event. CHECK: psd_event_id NOT NULL AND partner_id NULL.
tax_payment          — Government tax payment (withdraw movement). Optional kdv_period.
shipment_billing     — Accrual created at shipment book; sum of qty × unit_sales_price.
shipment_cogs        — Accrual; sum of qty × est_purchase_unit_price (recognized at book).
shipment_freight     — Accrual; freight_cost from shipment.
```

Removed kinds (historical): `order_billing`, `other_expense` (collapsed into `expense`), `adjustment`.

`KIND_SPAWN_DIRECTION` controls which kinds spawn a treasury movement automatically:

| Kind | Direction | Account field used |
|---|---|---|
| `client_payment` | deposit | `to_account_id` |
| `client_refund` | withdraw | `from_account_id` |
| `supplier_payment` | withdraw | `from_account_id` |
| `expense` (business-paid) | withdraw | `from_account_id` |
| `other_income` | deposit | `to_account_id` |
| `partner_loan_in` | deposit | `to_account_id` |
| `partner_loan_out` | withdraw | `from_account_id` |
| `profit_distribution` | withdraw | `from_account_id` |
| `tax_payment` | withdraw | `from_account_id` |
| `supplier_invoice`, `shipment_billing`, `shipment_cogs`, `shipment_freight` | none (accrual only) | — |
| `expense` (partner-paid) | none | — |

### 4.2 Treasury / Holdings (Quantity as Source of Truth)

The defining principle (from `treasury.md`): **every holding is stored as quantity in its native unit, never as a USD-equivalent.**

- `accounts` rows describe what + where (asset_code + custody_location).
- `treasury_movements` is a signed-quantity ledger.
- **Balance per account** = `SUM(treasury_movements.quantity WHERE account_id = X)`.
- **USD value** is computed at display: `quantity × latest_price_snapshot × latest_fx_snapshot`.
- USD is **never stored** as a balance.

Movement kinds and signs:
- `opening`, `deposit`, `transfer-in`, `trade-in` → positive
- `withdraw`, `transfer-out`, `trade-out` → negative
- `adjustment` → user-entered sign (signed-non-zero allowed)

Transfer guard (mutation layer): `from.asset_code === to.asset_code` AND `|qty_from| === |qty_to|`. Trade guard: `from ≠ to` AND assets must differ.

Ortak custody (`requires_movement_type=true`) requires every movement to specify `ortak_movement_type ∈ {partner_loan_in, partner_loan_out, profit_share}` so accounting can later post to the right GL bucket.

### 4.3 FX — Two Distinct Jobs

**Job 1: Wallet display (treasury page).** Computed at render time from the latest `fx_snapshots`. Stamped with the snapshot date. If the most recent snapshot is > `FX_STALE_MS = 24h` old, the USD column is greyed.

**Job 2: Frozen FX on customer balance transactions.** When a `client_payment` arrives in a currency that differs from the customer's `balance_currency`, the user enters `fx_rate_applied` and the app stores `fx_target_currency` and `fx_converted_amount`. **These are never recomputed.** Tomorrow's rate change does not move yesterday's promise.

### 4.4 KDV (Turkish VAT) Reporting

**Module:** `src/features/tax/` + `src/lib/ledger/kdv-summary.ts`.

**Period concept:** `YYYY-MM` derived from `transaction_date` in **Istanbul timezone** (`istanbulYearMonth(date)`). Beyanname is filed monthly; deadline is the 26th of M+1.

**Collected vs Paid:**
- **VAT collected** = sum of `vat_amount` on `kind ∈ {shipment_billing, other_income}` rows in TRY for the period.
- **VAT paid** = sum of `vat_amount` on `kind ∈ {supplier_invoice, expense}` rows in TRY for the period.
- **Net** = collected − paid. Positive = owed to government; negative = carry-forward credit.

**Status:**
- Per period, find the `transactions` row with `kind='tax_payment'` AND `kdv_period = period`. Sort by `transaction_date DESC, id DESC`; pick the newest as the linked payment.
- `status = 'filed'` if linked payment exists, else `'unfiled'`. If no VAT activity at all, status is "no activity".

**Non-TRY filtering:** Transactions in non-TRY currencies are excluded from VAT totals and counted in `skipped_count`. UI shows an expandable amber alert: `"N transaction(s) in this window [is/are] in non-TRY currencies and [is/are] excluded from KDV totals."`

**Allowed VAT rates:** `0, 1, 10, 20` (Turkish standard rates) per `KDV_RATES`. Free-text not allowed in product form.

**Filing flow:**
1. KDV page row "Net = X" with status "Unfiled".
2. Click "Record payment" → navigates to `/transactions?action=new&kind=tax_payment&kdv_period={period}&amount={max(0,net)}&currency=TRY&reference_number_placeholder=BEYAN-{period}`.
3. User enters reference_number (e.g. "BEYAN-2026-04") and saves.
4. KDV row now shows "Filed · BEYAN-2026-04".

**CSV export:** See Section 8.5.

### 4.5 FIFO Allocation (Customer Ledger)

**Module:** `src/lib/ledger/fifo-allocation.ts` (pure, stateless, fully tested).

Used for: customer ledger summary, AR outstanding aggregation, shipment statement payment block.

**Input:**
```
LedgerEvent[] {
  id, date, created_time, kind, amount, currency,
  related_shipment_id, fx_converted_amount, fx_target_currency
}
displayCurrency: string   // e.g. customer.balance_currency
```

**Output:**
```
{
  shipment_allocations: [
    { shipment_billing_id, related_shipment_id, billed_amount, paid_amount, outstanding_amount, is_fully_paid }
  ],
  payment_allocations: [
    { payment_event_id, payment_date, shipment_billing_id, related_shipment_id, allocated_amount }
  ],
  unallocated_credit: number,
  total_billed, total_paid, net_balance: number,
  skipped_events: [{ event, reason: 'no_fx' | 'missing_shipment' }]
}
```

**Algorithm:**
1. **Effective amount per event** (`effectiveAmount`): if event currency = `displayCurrency`, use `amount`. Else if `fx_target_currency = displayCurrency` and `fx_converted_amount` set, use that. Else return `null` (skip with `reason='no_fx'`).
2. **Sort events** by `(date asc, created_time asc, id asc)` → stable FIFO order.
3. **Process each event:**
   - `shipment_billing` → push BillingSlot `{ event, billed: amount, paid: 0 }`. Skip if no `related_shipment_id` (`reason='missing_shipment'`).
   - `client_payment` → walk billings oldest-first, consume capacity (`billed - paid`) up to remaining payment amount. Park excess in `unallocated_credit`.
   - `client_refund` → first reduce `unallocated_credit`; then walk billings *newest-first*, reducing `paid` (capped at zero).
4. **Retroactive prepayment matching:** after the main loop, iterate billings again and drain `unallocated_credit` into any slot with remaining capacity.
5. **Compute outputs:** per BillingSlot, `outstanding = billed - paid`, `is_fully_paid = outstanding ≤ 0.001`. Aggregate totals.

The same allocator runs on every render — no caching, no stored allocation rows. This guarantees the ledger stays in sync with any retroactive edit.

### 4.6 Supplier Ledger

**Used by:** `SupplierLedgerSection`.

For supplier-like contacts (`type ∈ {supplier, logistics}`):
- **Total invoiced** = Σ `supplier_invoice.amount` in `balance_currency`.
- **Total paid** = Σ `supplier_payment.amount` in `balance_currency`.
- **Per invoice outstanding** = invoice.amount − Σ `supplier_payment.amount WHERE related_payable_id = invoice.id`.
- **Status badges:** "Fully paid" (emerald), "Partially paid" (amber), "Open" (sky).

`supplier_payment.related_payable_id` is the optional self-FK that links a payment to the specific invoice it (partly) settles.

### 4.7 Real-Estate Installment Allocation

**Module:** `src/lib/ledger/installment-allocation.ts`.

**Input:** installments (`due_date, expected_amount, sequence`), receipts (`date, amount`), today.

**Output:**
```
DealAllocationResult {
  installments: [
    { installment_id, due_date, expected_amount, sequence,
      paid, outstanding, status: 'paid' | 'partial' | 'due' | 'overdue' }
  ],
  total_expected, total_paid, total_outstanding, unallocated_payment
}
```

**Algorithm:**
1. Sort installments by `(due_date, sequence, id)`.
2. Sort receipts by `(date, id)`.
3. For each receipt, walk installments oldest-first; allocate up to `expected − paid`; spill into `unallocated_payment`.
4. Status:
   - `outstanding ≤ 0.001` → `paid`
   - `paid > 0.001 AND outstanding > 0.001` → `partial`
   - `due_date < today` → `overdue`
   - else → `due`

Used for: real-estate deal cards (status badges), the pending-receipts strip on `/real-estate`, the contact's real-estate section.

### 4.8 Partner Reimbursement Allocation

**Module:** `src/lib/ledger/partner-reimbursement-allocation.ts`.

**Reimbursable claims:** transactions with `kind='expense'`, `partner_id` set, `from_account_id IS NULL` (signaling partner paid out-of-pocket). Grouped per `currency`.

**Reimbursement payouts:** transactions with `kind='partner_loan_out'` AND `is_loan=false`. Grouped per `currency`.

**Algorithm (per currency, per partner):**
1. Sort claims by `(date, id)`.
2. Sort payouts by `(date, id)`.
3. Walk payouts; for each, settle oldest claims first up to `claim.amount − amount_settled`. Spill to `unallocated_payout`.

**Output:**
```
{
  by_currency: {
    [ccy]: {
      claim_allocations: [{ claim_id, claim_date, claim_amount, amount_settled, outstanding, is_fully_settled }],
      total_claimed, total_paid, total_outstanding, unallocated_payout
    }
  }
}
```

Used for: dashboard "Partner Reimbursements" card, partner detail "Pending reimbursements" card, the "Pay reimbursements" CTA on `/partners`.

### 4.9 Partner Loans (`is_loan=true`)

`is_loan` is a boolean flag on `transactions` (CHECK enforces it can only be true on `partner_loan_out` / `partner_loan_in` rows with `partner_id` set). Loans are distinct from reimbursements:

- A loan disbursement is a `partner_loan_out` with `is_loan=true`. The transaction itself *is* the loan record.
- Optional installment schedule lives in `loan_installments` (FK CASCADE on transaction delete).
- Repayments are `partner_loan_in` with `is_loan=true`. They consume the oldest open installment first within (partner, currency).
- Outstanding per loan = `principal − Σ allocated repayments`.

The FIFO reimbursement allocator excludes `is_loan=true` rows by predicate.

### 4.10 PSD (Profit-Share Distribution)

**Why:** Yusuf wants "how much left the company", not "who got which dollar". So PSD legs never carry `partner_id`.

**Schema:**
- `psd_events` is the parent (one event date, optional fiscal_period like "2026-Q1").
- Each leg is a `transactions` row with `kind='profit_distribution'`, `psd_event_id` set, `partner_id NULL`. CHECK constraint enforces this exactly.
- Multiple legs allow a single distribution to span currencies and source accounts.

**Calendar drawer:** months × years grid (3 years of history). Each cell shows stacked currency totals; clicking opens a popover listing the events behind it.

### 4.11 Recurring Payments — Lazy Materialization

A monthly template (`recurring_payments`) doesn't write a row per month. Pending months are *derived*: a template is "due" for (Y, M) if no `recurring_payment_occurrences` row exists for that (template, year, month) AND the template is active AND the period overlaps `effective_from`/`end_date`.

**Mark paid flow** (`markOccurrencePaid`):
1. Build `transactions` row from the template (`description = "{name} — {Month Year}"`, kind/currency/account/contact/expense_type from template).
2. Insert `transactions`.
3. Spawn movement via `spawnMovementFromTransaction`. On failure, delete the transaction.
4. Insert `recurring_payment_occurrences` row with `transaction_id` linked. On failure, delete movement + transaction.

**Skip:** Insert occurrence with `status='skipped'`, no transaction.

**Undo:** Delete occurrence; if it had a `transaction_id`, also delete the transaction (cascades movement). The month becomes "pending" again.

**Day clamping:** If `day_of_month=31` and the month has fewer days (e.g. Feb), `effectiveDayForMonth` clamps it to the last day.

### 4.12 Order Lifecycle

7 statuses (`ORDER_STATUSES`): `inquiry → quoted → accepted → in_production → shipped → delivered`, plus `cancelled` (off-ramp).

**Transition gates** (`advanceOrderStatus`):
- `inquiry → quoted`: ≥1 line AND every line has `unit_sales_price > 0` AND `offer_date`/`incoterm`/`payment_terms` filled. (Otherwise: cannot generate proforma.)
- `quoted → accepted`: free.
- `accepted → in_production`: free.
- `in_production → shipped`: order has `shipment_id` AND shipment status ≠ 'draft'. (Cascaded by `advanceShipmentStatus(... → 'in_transit')`.)
- `shipped → delivered`: free.
- Terminal: `delivered`, `cancelled`. No further transitions.

**Cancellation:**
- Requires `reason.trim().length ≥ 3` (Zod) — UI message: "Cancelling detaches the order from any shipment. This is logged and cannot be undone from the UI."
- Detaches `shipment_id` AND `billing_shipment_id` (NULLs both).
- Stamps `cancelled_at = now()`, `cancellation_reason`.
- Calls `refreshShipmentBilling` on the previous billing shipment (so the billing row drops the cancelled order's lines).
- DB invariant: `CHECK ((status='cancelled') = (cancelled_at IS NOT NULL))`.

**Aging buckets** (`STUCK_THRESHOLDS_DAYS`):

| Status | Warn | Alarm |
|---|---|---|
| inquiry | 14 | 30 |
| quoted | 30 | 60 |
| accepted | 30 | 60 |
| in_production | 45 | 90 |
| shipped | 30 | 60 |

The Orders index "Only stuck" filter shows orders past warn threshold for their status.

### 4.13 Shipment Lifecycle and Accruals

4 statuses: `draft → booked → in_transit → arrived`.

**`draft → booked` accruals (key event):** For each assigned order, three accrual rows are inserted into `transactions`:

1. **`shipment_billing`** — sum over its order_details of `quantity × unit_sales_price`. Carries `related_shipment_id`, `currency = shipment.invoice_currency`, VAT trio if applicable, no account.
2. **`shipment_cogs`** — sum of `quantity × est_purchase_unit_price`. Recognized as expense in P&L.
3. **`shipment_freight`** — `shipment.freight_cost` (proportionally allocated if multiple orders share the freight; current implementation puts the full freight on the shipment-level row, not split).

These are subject to `uniq_shipment_accrual` (partial unique on `(related_shipment_id, kind)`) so double-clicks can't create duplicates.

**`booked → in_transit`:** auto-cascades all linked orders from `accepted`/`in_production` to `shipped`. **Hard-blocked** if any linked order is still `inquiry` or `quoted` — user must resolve first.

**`in_transit → arrived`:** metadata only. No order cascade. No billing refresh.

**Edits while booked:** `refreshShipmentBilling(shipment_id)` recomputes billing/cogs totals and updates the existing rows in place.

**Two shipment FKs:** `orders.shipment_id` is *physical*; `orders.billing_shipment_id` is *financial*. They default to the same value when assignment happens, but can diverge for "ship next month, bill this month" rollovers. The shipment statement PDF marks rolled-over lines as `Facturé sur {other shipment}`.

### 4.14 Profit & Loss Computation

**Inputs:** all `transactions`, all `fx_snapshots`, all `monthly_fx_overrides`.

**Period:** `YYYY-MM` in Istanbul timezone.

**Revenue classification:**
- `kind = 'shipment_billing'`
- `kind = 'other_income'`
- `kind = 'client_payment'` AND `real_estate_deal_id IS NOT NULL`

**Revenue split:**
- "Real estate" if `real_estate_deal_id` set.
- "Export" otherwise.

**Expense classification:**
- `kind = 'expense'`
- `kind = 'shipment_cogs'`
- `kind = 'shipment_freight'`

`supplier_invoice` is **deliberately excluded** (it's a payable, not P&L expense — COGS comes through `shipment_cogs` at booking).

**Currency conversion:**
- USD: pass through.
- TRY: converted via `resolveMonthlyRate(period, 'TRY', overrides, snapshots)`. Priority: monthly override → snapshot in same period → newest-before-or-at-period (marked stale) → null (UI shows "—" and disables USD totals).
- Other currencies: marked `hasUnconverted`; bucket totals become null in the trend.

**Multi-period view** (quarterly/annual): each column sums constituent months' USD totals. If ANY month has missing rate or unconverted currency, the bucket displays `—` in USD.

**Trend:** trailing 12 months (single-period view) or per-bucket (multi-period view). Negative netUsd shown as rose bar; positive as emerald; null as muted dashed bar.

### 4.15 Invoice Numbering

**Offer number** (proforma):
- Format: `TG-YYYYMMDD-NNN` where `YYYYMMDD` is the offer date in Istanbul timezone and `NNN` is a 3-digit zero-padded sequence (001…999).
- `generateOfferNumber(supabase, offerDateIso)` queries `orders.offer_number LIKE 'TG-{YYYYMMDD}-%'`, parses the suffix as int, returns `MAX + 1`. Skipping deleted offers prevents duplicates.
- Manual override available via the form's "Override" button — bypasses generation.
- Auto-generation triggers on first save of proforma metadata (`updateOrderProformaMetadata`).

**Shipment naming:** `name` is free text. New shipment dialog defaults to "Shipment #N" where `N = countShipmentsForCustomer(customer_id) + 1`. Users can edit.

**KDV reference number:** Free text on `tax_payment.reference_number`. Recommended format `BEYAN-{period}` (e.g. "BEYAN-2026-04") — pre-filled as placeholder when navigating from the KDV page.

There is **no general invoice numbering** — `transactions` use UUID PKs. Reference numbers are user-entered for traceability only.

### 4.16 Period Close

There is **no period close workflow**. Editing transactions for any past month is allowed; the P&L module recomputes on every render. Monthly FX overrides are the only way to "freeze" period numbers (and they're advisory — not enforced).

### 4.17 Receivables / Payables Workflows

**AR (Accounts Receivable):**
1. Shipment booked → `shipment_billing` accrual created per order.
2. Customer pays → `client_payment` recorded, optionally with FX freeze if currency differs from `balance_currency`.
3. FIFO allocation runs on every ledger view, settling oldest billing first.
4. Outstanding per shipment shown on the shipment statement PDF.
5. Refunds (`client_refund`) walk billings newest-first, reducing paid amount.

**AP (Accounts Payable):**
1. Supplier issues invoice → `supplier_invoice` accrual recorded (with reference_number required).
2. Business pays → `supplier_payment`, optionally with `related_payable_id` linking to the invoice row.
3. Per-invoice outstanding = invoice amount − Σ linked payments.
4. The "Open invoices" combobox in the supplier-payment form pre-fills amount/currency on selection.

### 4.18 Reconciliation

There is **no automatic bank reconciliation**. Treasury balances always equal SUM(treasury_movements.quantity), so reconciling against a bank statement is manual: compare the in-app balance to the bank's statement balance and add `adjustment` movements to close any gap.


---

## 5. Frontend — Pages & Routes

All routes (except `/login` and `/auth/...`) live under the App Router segment `(app)/`, which renders the `AppLayout` (sidebar + main content). Public paths defined in `proxy.ts`: `['/login', '/auth/callback']`. Unauthenticated users hitting any other path are redirected to `/login?next=<path>`.

### 5.0 Root Layout (`src/app/layout.tsx`)

- Loads three Google Fonts via `next/font/google`:
  - `Inter` (variable, weights 400/500/600/700) → `--font-inter`
  - `Instrument_Serif` (weight 400, normal+italic) → `--font-serif`
  - `IBM_Plex_Mono` (weights 400/500) → `--font-plex`
- HTML `lang="en"`, classes apply font variables.
- Body: `min-h-full flex flex-col bg-background text-foreground`.
- Wraps children in `<Providers>` (TanStack QueryClient + Devtools).
- Mounts `<Toaster />` (Sonner).
- Metadata: `title: "Turc Global ERP"`, `description: "Finance + logistics, in one place."`

### 5.1 `/` — Root Index

- File: `src/app/page.tsx`.
- Behavior: `redirect("/dashboard")`.

### 5.2 `/login` — Magic-Link Sign-In

- Files: `src/app/login/page.tsx` + `src/components/login-form.tsx`.
- **Layout:** centered `Card` (max-width sm) with `CardHeader` ("Turc Global ERP" title + "Sign in to continue." subtitle) and `CardContent` containing the `<LoginForm />`.
- **Form:**
  - Single `email` input (autocomplete email, required).
  - Submit button: `"Send sign-in link"`. While submitting: `<Loader2 spin /> Sending link…`.
  - Helper text: `"We'll email you a one-time link. No password needed."`
  - On submit: builds `redirectTo = "${origin}/auth/callback?next=${next}"` (`origin` from `NEXT_PUBLIC_SITE_URL` or `window.location.origin`), calls `supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } })`.
  - On error: toast `"Couldn't send the link"` with `description: error.message`.
  - On success: replaces form with confirmation (`<Mail />` icon, "Check your email", "We sent a sign-in link to {email}. Click it to finish signing in.", and a "Use a different email" ghost button).
  - Toast: `"Check your inbox"` with `description: "We sent a sign-in link to ${email}."`.
- **States:** loading (button spinner), success (confirmation block), error (toast).

### 5.3 `(app)` Layout (`src/app/(app)/layout.tsx`)

- **Auth gate:** if `!AUTH_DISABLED`, calls server `supabase.auth.getUser()`; if no user, `redirect("/login")`. Else `userEmail = user.email ?? ""`. When `AUTH_DISABLED`, `userEmail = "dev@local"`.
- **Layout structure:**
  ```
  <TooltipProvider>
    <SidebarProvider>
      <AppSidebar userEmail={userEmail} />
      <SidebarInset>
        <div className="flex-1 p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  </TooltipProvider>
  ```
- `error.tsx` boundary: shows centered card "Something went wrong" with `Try again` (calls `reset()`) and `Reload` (`window.location.reload()`) buttons.
- `loading.tsx`: skeleton placeholders (h-8 title + 3 stat cards + 1 large block).

### 5.4 `/dashboard`

- **Page:** `src/app/(app)/dashboard/page.tsx` → renders `<DashboardIndex />` from `features/dashboard/dashboard-index.tsx`.
- **Layout:**
  - Top: 3-card grid (1 col mobile, 3 col desktop):
    - **TreasurySnapshotCard** — title "Treasury", linked to `/treasury`. Shows total USD value, FX staleness indicator, refresh-error badge.
    - **ArOutstandingCard** — title "Accounts Receivable", linked to `/shipments`. Per-currency breakdown, total in primary currency.
    - **PartnerReimbursementCard** — title "Partner Reimbursements", linked to `/partners`. Per-currency breakdown.
  - Each card is wrapped by `CardShell` — entire card is a clickable Link with hover ChevronRight icon. Errors show a `<ErrorTile>` with "Retry" button.
- **Below: AttentionList:**
  - Header: "Needs your attention".
  - Loading: 3 skeleton rows.
  - Errors: inline retry rows per failed query.
  - Items sorted by severity (red, then amber), then stable id.
  - Per item: `AlertCircle` (red) or `AlertTriangle` (amber) icon, label, entity detail, age string, link to relevant module.
  - Empty: "Nothing needs your attention right now."
- **States:** loading (skeletons), partial (some cards rendered, others as ErrorTile), error per card with retry, empty (attention list).

### 5.5 `/contacts`

- **Page:** `src/app/(app)/contacts/page.tsx` → `<ContactsIndex />`.
- **Layout (active view):**
  - Header: title "Contacts", subtitle "Customers, suppliers, logistics providers, and other parties.", "Archive" button (right).
  - Toolbar:
    - Search input: placeholder `"Search company, person, email, phone…"`.
    - Type filter `Select`: "All types" + each `CONTACT_TYPE_LABELS` value.
    - "Group by country" toggle button.
  - Display: `ContactsTable` (desktop, ≥ md) or `ContactsCardList` (mobile). Optionally grouped by country (countries asc; "No country" 🏳 bucket for null).
  - Empty state: "No contacts yet." + "Add your first contact" button.
  - "+ New contact" button (header, also FAB on mobile).
- **Layout (archive view):**
  - Subtitle: "Deleted contacts. Restoring brings a contact back to your active list with all its data intact."
  - Search input.
  - "Back to contacts" button (toggles back).
  - Table from `ArchivedContactsTable`: Type | Company | Contact | Country | Deleted | Actions. Empty: "Archive is empty".
- **Tables:**
  - Active columns: Type | Company | Contact | Phone | Email | Country | Currency | Balance | Actions.
  - **Balance display:** red (`text-rose-700`) if positive (owes us), green (`text-emerald-700`) if negative (we owe), muted if zero. Asterisk `*` if `has_skipped=true` with tooltip `"Some transactions in another currency are excluded from this total."`.
- **Modals/dialogs:** ContactFormDialog, DeleteContactDialog, RestoreContactDialog, AddNoteDialog (only on detail).

#### 5.5.1 `/contacts/[id]`

- **Page:** `src/app/(app)/contacts/[id]/page.tsx` does server-side existence check (404 if not found), then renders `<ContactDetail contactId={id} />`.
- **Sections:**
  1. Back link: "← Back to contacts".
  2. Header: type badge + country flag + company name + contact person.
  3. Tax ID / Vergi Dairesi line if present.
  4. Edit / Delete buttons.
  5. **Details card:** phone, email, address, city, country, balance_currency, notes.
  6. **Activity log card:** "Add note" button + chronological notes (newest first).
  7. **Conditional ledger sections:**
     - `type='customer'` → `<ContactLedgerSection>`.
     - `type='supplier'` → `<SupplierLedgerSection>`.
  8. `<ContactRealEstateSection>` (always — shows real-estate deals where `contact_id = this`).
- **Contact Ledger (customer):**
  - Header stats: net balance (color-toned), label "owes us"/"we owe them"/"settled", total billed, total paid, unallocated credit (if > 0), skipped events (if > 0).
  - Filters: From / To dates / Event kind / Shipment.
  - Rows: Date | Event badge | Reference (shipment link or `reference_number` or "—") | Amount (signed) | Running balance.
  - `shipment_billing` rows expand to show payment allocations from oldest.
- **Supplier Ledger:** "Total invoiced" / "Total paid" / "Net outstanding" tiles. Invoices table (Date | Reference | Amount | Outstanding | Status: "Fully paid" emerald / "Partially paid" amber / "Open" sky). Payments table (Date | Amount | Linked invoice).

### 5.6 `/partners`

- **Page:** renders `<PartnersIndex />`.
- **Header:** "Partners" + "Reimbursements, profit share, loans" subtitle. "Manage partners" gear button (opens drawer).
- **Sections (in order):**
  1. `<PendingReimbursementsSection>` — title "Pending reimbursements", subtitle "Out-of-pocket expenses each partner is still owed.". "Log partner expense" button → `/transactions?…`. Per-partner: name (link), outstanding amount, claim count, "Pay reimbursements" button.
  2. `<PsdSection>` — left side: "PSD {currentYear} YTD" with totals by currency. Buttons: "Calendar" (drawer) and "Log PSD" (dialog).
  3. `<LoansSection>` — left side: "Loans outstanding" with totals by currency. Buttons: "Schedule" (drawer), "Record repayment" (dialog), "Log loan" (dialog).
- **Manage Partners Drawer:** Search input ("Search partners…"), "Show deleted (N)" toggle, "Add partner" button. Table or card list. Active first, then status, then alphabetical. Inactive dimmed (`opacity-60`); deleted dimmed (`opacity-40`).

#### 5.6.1 `/partners/[id]`

- Server-side fetch validates partner; 404 via `not-found.tsx` if not found; loading via `loading.tsx`.
- **Sections:**
  1. Breadcrumb "Partners › {name}".
  2. Header: status badge + name + "Partner since {earliest activity or created date}". Edit button.
  3. `<PartnerActivitySums>` — 4 cards:
     - "Capital received" (ArrowDownLeft, emerald): partner_loan_in where `is_loan=false`. Subtitle: "Partner money into the business".
     - "Loan repayments received" (HandCoins, sky): partner_loan_in where `is_loan=true`. Subtitle: "Loans the partner has paid back".
     - "Reimbursements paid" (ArrowUpRight, sky): partner_loan_out where `is_loan=false`. Subtitle: "Money out to the partner (non-loan)".
     - "Partner-paid expenses" (Receipt, amber): expense rows with `partner_id` set and no `from_account_id`. Subtitle: "Lifetime, regardless of settlement".
  4. `<PartnerPendingReimbursementsCard>` — only if any currency outstanding > 0.001.
  5. `<PartnerLedgerSection>` — chronological transactions table with running tally in `currency`.

### 5.7 `/products`

- **Page:** `<ProductsIndex />`.
- **Layout:**
  - Header: "Products" + "Manage your product catalog". "+ New product" button.
  - Filters: Active/All toggle, Category combobox, Supplier combobox, Search input.
  - View toggle: Table / Card list (responsive).
  - "Batch add products" button (`ClipboardPaste` icon).
  - Floating "+ New product" FAB on mobile.
- **Tables:** product_name, client_product_name, kdv_rate, est_purchase, default_sales, default_supplier, category. "Needs details" badge on rows missing must-have fields. "Active" badge.

#### 5.7.1 `/products/[id]`

- Header: product image, name, Active badge, Edit / Delete.
- Cards grid: client_product_name, description, barcode, hs_code; unit, category, default supplier; est_purchase + currency, default_sales + currency; kdv_rate; CBM / weight per unit; packaging type + dimensions.
- `<ProductOrdersList>` — table of orders containing this product.

### 5.8 `/orders`

- **Page:** `<OrdersIndex />`.
- **Layout:**
  - Header: "Orders" + "Every client order, from inquiry through delivery". "+ New order" button.
  - Filters bar: Status filter (multi-select popover), Group by toggle (flat / customer / status / shipment).
  - Search and date filters: text search ("Search by customer, offer #, ID, shipment, or notes…"), From / To date inputs, "Only stuck" checkbox, "Clear filters" button.
  - Summary row: Order count + "Pipeline value" (sum of USD-converted totals).
  - Main table grouped by chosen criteria. Columns: Order # | Date | Customer | Status | Lines | Total | USD | Shipment. Status badges with aging indicator (0/1/2 day labels). Cancelled rows dimmed. Group footers show subtotals (when not flat).
  - Floating FAB "+ New order" (mobile).

#### 5.8.1 `/orders/[id]`

- Back link to `/orders`.
- Header card: Order ID | Status badge | Customer name | Order date | Currency | Total amount.
- **Status stepper:** shows lifecycle (inquiry → quoted → accepted → in_production → shipped → delivered) with `cancelled` as separate branch. Active step highlighted. Buttons: "Generate proforma", "Advance to {NextStatus}", "Cancel order".
- **Line items section:**
  - Table columns: # | Product | Qty | Unit | Sales price | Est. purchase | VAT | Supplier | Packaging edit | Delete.
  - "Add a product…" combobox + "Add line" button.
  - "Batch add lines" button (only enabled for inquiry / quoted / accepted statuses).
- **Proforma details section** (expandable):
  - Form fields: Offer number (read-only display + Override button), Offer date, Offer valid until, Incoterm (creatable combobox), Delivery timeline, Payment terms (creatable combobox).
  - Notes/Conditions: Remark (default `"This offer is denominated in {currency}. VAT: 0% (export)."`), Offer validity, Delivery location, Production time, Length tolerance, Total weight.
  - "Save proforma details" button.
- **Shipment section** (2-col grid):
  - If assigned: shows shipment name (link), "Reassign" button, "Remove from shipment" button, note if billed on different shipment.
  - If unassigned: "Assign to shipment" button.
- **Attachments:**
  - Customer PO slot: Upload / Replace / View / Remove.
  - Proposal PDF: View link if present, or "Not generated yet. Fill proforma details…" message.
- Notes section: raw `notes` as preformatted text.
- Footer: created/edited metadata.

### 5.9 `/shipments`

- **Page:** `<ShipmentsIndex />`.
- **Layout:**
  - Header: "Shipments" + "Physical and financial groupings of orders". "+ New shipment" button.
  - Status filter (multi-select popover).
  - Table: Name | Date | Customer | Status | Transport | Container | CBM | Weight | Orders | Total. Rows clickable.

#### 5.9.1 `/shipments/[id]`

- Back link, Edit button.
- Header card: name, status badge, customer, dates, transport method, invoice currency.
- Status stepper draft → booked → in_transit → arrived. "Advance shipment" dialog shows preview of accruals to be created if booking.
- **Billing card** (`ShipmentBillingCard`): total invoice amount + breakdown by currency.
- **Capacity card** (`ShipmentCapacityCard`): total CBM, weight, container utilization (e.g. "1.5/33.0 CBM in 20DC").
- **Manifest table** (`ShipmentManifestTable`): orders assigned, lines, qty, unit, prices.
- Billing history (after booked): `BillingHistorySummary`, `PaymentsAppliedTable`.
- "Generate statement" button (creates / downloads PDF).
- Documents section: upload / manage supporting docs.
- Edit dialog modal.

### 5.10 `/treasury`

- **Page:** `<TreasuryIndex />`.
- **Header:**
  - Title "Treasury" + subtitle "Holdings across every custody, in native units. USD is display only.".
  - USD total in 3xl font.
  - "USD view — rates from {date}" with `(stale)` suffix if > 24h.
  - Last refresh stamp (relative: "5 minutes ago" / "2 hours ago" / "3 days ago" / "never").
  - If auto-refresh delayed beyond cron + 15min grace: yellow pill "Auto-refresh delayed — check function logs".
  - If FX stale: title hint "FX rates are more than 24 hours old — click Refresh rates".
- **Header buttons:** "Refresh rates" (with spin icon during pending; label "Refreshing…"), "Record movement".
- **Grouping pills:** "Asset type" / "Custody" / "Flat".
- **Show-zero toggle:** "Show 0-balance (N)" / "Hide 0-balance (N)".
- **Holdings table per group:** Asset | Custody | Quantity | Unit price | USD value (when applicable) | Last activity. Asset type group order: Fiat → Credit cards → Fund → Crypto → Metal.
- **Modals:** AddHoldingDialog (multi-step wizard), RecordMovementDialog (discriminated by movement kind).

### 5.11 `/accounts`

- **Page:** `<AccountsIndex />`.
- Account registry (all non-deleted, including inactive). Table: name | asset_code | asset_type | custody location | active badge. Actions: Edit, Deactivate / Reactivate, Delete.

#### 5.11.1 `/accounts/[id]`

- Account detail with custody info, opening balance, recent movements, edit / lifecycle controls.

### 5.12 `/transactions`

- **Page:** `<TransactionsIndex />`.
- Reads URL params for prefill (`action=new&kind=…&...`) used by KDV "Record payment", Partners "Pay reimbursements", etc.
- Filters: kind (multi), date range, contact, partner, account, search.
- Table: Date | Kind badge | Description | Counterparty | Amount | Currency | Account.
- Transaction form dialog: 2-3 level wizard following `KIND_CATEGORIES` (Money in / Money out → Operating / Partner / Bills).
- Edit/delete actions on rows.

### 5.13 `/tax`

- **Page:** `<KdvPage />`.
- Header: "KDV (Turkish VAT)" + "Monthly VAT collected and paid. All amounts in TRY.". "Export" dropdown listing all periods.
- Table columns: Month | Collected VAT | Paid VAT | Net | Status | Actions.
- Net text: amber-700 positive ("owed"), emerald-700 negative ("carry-forward"), normal zero.
- Status badges: "Filed" (emerald, with reference like "Filed · BEYAN-2025-04"), "Unfiled" (amber), "No activity" (muted outline).
- Actions: "View payment" (link to `/transactions?action=edit&id=...`) or "Record payment" (link with prefill). Or "—".
- Non-TRY warning: expandable amber alert showing skipped rows.

### 5.14 `/profit-loss`

- **Page:** `<ProfitLossIndex />`.
- Header: "Profit & Loss" + dynamic subtitle per frequency:
  - Monthly: "Monthly revenue, expense, and net result — TRY entries converted to USD at the month's rate."
  - Quarterly: "Quarterly totals — each column sums its three monthly USD values."
  - Annual: "Annual totals — each column sums its twelve monthly USD values."
- Toolbar: `<ProfitLossFrequencyToggle>` (Monthly / Quarterly / Annual buttons) + month picker (monthly) or year picker (else).
- **Monthly view:**
  - `<RateBanner>` — Missing (amber, AlertTriangle, "No USD/TRY rate for {Month}. USD totals are hidden until you set one.") / Override (emerald, "1 USD = X.XX TRY · source: override · date") / Stale (amber, "1 USD = X.XX TRY · source: snapshot · stale (no rate inside this month)") / Current (muted, "1 USD = X.XX TRY · source: snapshot · date"). Actions: Override… / Edit override / Clear override.
  - 3 summary cards (Revenue / Expense / Net P&L): USD value (color), TRY value below, Revenue card breaks Export / Real Estate split.
  - Detail table grouped Revenue / Expense, columns: Date | Project | Currency | Native amount | USD amount.
  - `<ProfitLossTrend>` — 12-month trailing bar chart, click bar to navigate.
- **Multi-period view (quarter / year):**
  - Table rows: "Revenue — Export", "Revenue — Real Estate", "Total Revenue", "Total Expense", "Net P&L". Columns per quarter or year.
  - Missing-rate icon (AlertTriangle) per cell with tooltip explaining N missing months.
  - `<ProfitLossTrendMulti>` chart below.
- **Override dialog:**
  - Title: "Override USD/TRY rate".
  - Description: "Pin a manual rate for {Month}. All TRY entries in this month will be re-converted to USD using this rate."
  - Field 1: "1 USD = (TRY)" with placeholder "39.75" and helper "e.g. 39.75 means 1 USD buys 39.75 TRY."
  - Field 2: "Note (optional)" with placeholder "Source / rationale".
  - Buttons: Cancel / Save rate.

### 5.15 `/real-estate`

- **Page:** `<RealEstateIndex />`.
- Header: "Real Estate" + "Manage properties and installments".
- PendingReceiptsStrip: installments due this week or overdue + "Record" buttons.
- Deals grid/list: each `<DealCard>` expandable; chevron, label + sub_type badge (rent/sale) + status badge ("Settled" emerald / "Overdue" destructive / "Active · partial" amber / "Active"). Outstanding bold; expanded shows installment rows.
- Dialogs: DealFormDialog (label, sub_type, contact, currency, start_date, notes, installments + "Apply equal split"), ReceiptFormDialog.

### 5.16 `/settings`

- **Page:** `<SettingsIndex />`.
- Section 1: `<CompanyInfoSection>` — title "Company info", subtitle "Letterhead used on proforma invoices and shipment statements.". Form fields: company_name, address_line1, address_line2, phone, email (all required, max 200). Buttons: Reset / Save changes.
- Section 2: `<CustodyLocationsSection>` — title "Custody locations", subtitle "Where accounts live — banks, safes, partner pockets. Picked when you create or edit an account.". Table: Name | Type | Movement type required | Status | Actions. Form dialog (CustodyLocationFormDialog) with name (max 80) / type / requires_movement_type checkbox.


---

## 6. Frontend — Navigation Map

### 6.1 Sidebar Groups (`src/components/app-sidebar.tsx`)

The sidebar is permanent on desktop (collapsible to icon-only via Ctrl/Cmd+B or `<PanelLeftClose>` button). Mobile uses Sheet drawer (≥768px is desktop).

**Header:** Logo (`/just-tg.png`, 32px) + "Turc Global" / "ERP" labels + collapse button.

**Group 1: Operations**
| Title | Href | Icon |
|---|---|---|
| Contacts | `/contacts` | `Users` |
| Products | `/products` | `Package` |
| Orders | `/orders` | `ClipboardList` |
| Shipments | `/shipments` | `Ship` |

**Group 2: Finance**
| Title | Href | Icon |
|---|---|---|
| Treasury | `/treasury` | `TrendingUp` |
| Real Estate | `/real-estate` | `Building2` |
| Profit & Loss | `/profit-loss` | `LineChart` |
| Transactions | `/transactions` | `ArrowLeftRight` |
| Accounts | `/accounts` | `Wallet` |
| Partners | `/partners` | `HandCoins` |

**Bottom (mt-auto):**
| Title | Href | Icon |
|---|---|---|
| Settings | `/settings` | `Settings` |

`/tax` and `/dashboard` are not in the sidebar groups but are routable. `/tax` is reachable via the dashboard attention list. `/dashboard` is the post-login landing.

**Active highlight rule:** `pathname === href || pathname.startsWith(href + '/')` (so `/orders/abc` highlights "Orders").

**Footer:** `<UserMenu email={userEmail} />` — avatar with email initials, dropdown menu showing email + "Sign out" form (`<form action="/auth/signout" method="post">`).

### 6.2 Programmatic Navigation Patterns

| Source | Destination | Trigger |
|---|---|---|
| Login form success | `/dashboard` (or `?next=`) | Magic-link callback. |
| `/auth/callback` success | `${origin}${next}` | Code exchange OK. |
| `/auth/callback` failure | `/login?error=auth_callback_failed` | Code missing or exchange fail. |
| `/auth/signout` | `/login` | After `signOut()`. |
| Proxy: unauthenticated request | `/login?next=<original>` | No session. |
| Proxy: authenticated request to `/login` | `/dashboard` | Already signed in. |
| Root `/` | `/dashboard` | Static `redirect("/dashboard")`. |
| Dashboard cards | `/treasury`, `/shipments`, `/partners` | Card-shell `<Link>` wrapper. |
| Dashboard attention items | Module pages (e.g. `/shipments/{id}`, `/tax`, `/partners`, `/real-estate`) | Per attention rule's `href`. |
| KDV "Record payment" / "View payment" button | `/transactions?action=new&kind=tax_payment&kdv_period=…` or `/transactions?action=edit&id=…` | URL prefill pattern. |
| Partners "Pay reimbursements" | `/transactions?action=new&kind=partner_loan_out&partner_id=…&currency=…&amount=…` | |
| Partners "Log partner expense" | `/transactions?action=new&kind=expense&partner_id=…&paid_by=partner` | |
| Recurring history "View transaction" | `/transactions?action=edit&id=…` | |
| Order detail "Generate proforma" | Opens new tab to signed PDF URL | `generateProformaPdf(order_id)` returns signed URL. |
| Shipment detail "Generate statement" | Opens new tab to signed PDF URL | |
| Order/contact/product/partner row click | `/{module}/{id}` | Uses `<Link>`. |

### 6.3 Deep-Linking

- All entity detail pages take `[id]` from the URL. Server-side existence check returns 404 if missing or soft-deleted.
- The `?next=<path>` parameter on `/login` is preserved through the magic-link → callback → final redirect chain.
- The `/transactions` page consumes `?action=new&kind=…&...` to open the form pre-filled.

---

## 7. Frontend — Reusable Components

### 7.1 shadcn/ui primitives (`src/components/ui/`)

All copied (not depended on) so they're locally editable. shadcn config in `components.json` uses style `"radix-nova"`, `baseColor: "neutral"`, icon library `lucide`.

| File | Purpose |
|---|---|
| `alert-dialog.tsx` | Confirmation modal (Radix). Exports: AlertDialog, AlertDialogTrigger, AlertDialogPortal, AlertDialogOverlay, AlertDialogContent, AlertDialogHeader, AlertDialogFooter, AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel. |
| `avatar.tsx` | User/contact avatar; Avatar, AvatarImage, AvatarFallback. |
| `badge.tsx` | Status/category labels. Variants: default, secondary, destructive, outline. |
| `button.tsx` | Variants: default, secondary, destructive, outline, ghost, link. Sizes: default, sm, lg, icon. Uses `class-variance-authority`. |
| `card.tsx` | Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter. |
| `combobox.tsx` | Custom searchable dropdown built on Popover + Command. **Props:** `items: ComboboxItem[]` (`{value,label}`), `value: string \| null`, `onChange`, `placeholder?='Select…'`, `searchPlaceholder?='Search…'`, `emptyMessage?='No results.'`, `onCreate?(label)→Promise`, `createLabel?(query)='Create "{q}"'`, `disabled?`, `className?`, `clearable?=true`, `id?`. Behavior: type to filter; "Create '{query}'" row when no match and `onCreate` set; "Clear selection" row when value present and `clearable=true`. |
| `command.tsx` | cmdk wrapper: Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem, CommandSeparator, CommandShortcut. |
| `dialog.tsx` | Modal: Dialog, DialogTrigger, DialogPortal, DialogOverlay, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription. |
| `dropdown-menu.tsx` | Radix dropdown with checkbox/radio items, submenus. |
| `input-group.tsx` | Input wrapper with prefix/suffix slots. |
| `input.tsx` | Standard text input. |
| `label.tsx` | Form label. |
| `popover.tsx` | Floating popover. |
| `scroll-area.tsx` | Custom-scrollbar container. |
| `select.tsx` | Native-like dropdown (Radix). |
| `separator.tsx` | Horizontal/vertical divider. |
| `sheet.tsx` | Slide-out drawer (used for mobile sidebar, partners drawer, etc.). |
| `sidebar.tsx` | Layout sidebar (see below). |
| `skeleton.tsx` | Shimmer placeholder. |
| `sonner.tsx` | Toaster wrapper for Sonner. |
| `table.tsx` | Table primitives. |
| `textarea.tsx` | Multi-line input. |
| `tooltip.tsx` | Hover tooltip. |

### 7.2 Sidebar (`ui/sidebar.tsx`)

**SidebarProvider context:**
- Props: `defaultOpen?=true`, `open?`, `onOpenChange?`, `className?`, `style?`.
- State: desktop `open` (persisted to cookie `sidebar_state`, 7-day max age), mobile `openMobile` (not persisted), derived `state ∈ {expanded, collapsed}`, `isMobile` (from `useIsMobile`).
- Keyboard shortcut: Ctrl+B / Cmd+B → `toggleSidebar()`.
- CSS vars: `--sidebar-width: 16rem`, `--sidebar-width-icon: 3rem`. Mobile sheet width `18rem`.

**`useSidebar()`** — returns context value; throws outside provider.

**Children:** Sidebar, SidebarTrigger, SidebarRail, SidebarContent, SidebarGroup, SidebarGroupLabel, SidebarGroupAction, SidebarGroupContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarMenuAction, SidebarMenuBadge.

### 7.3 App-level Components

| Component | File | Purpose | Notes |
|---|---|---|---|
| `AppSidebar` | `components/app-sidebar.tsx` | Main nav (see Section 6.1). | Props: `userEmail: string`. |
| `UserMenu` | `components/user-menu.tsx` | Sidebar footer dropdown. | Computes initials from email; sign-out form. |
| `LoginForm` | `components/login-form.tsx` | Magic-link form. | Uses `useSearchParams` for `next`. |
| `Providers` | `components/providers.tsx` | Wraps QueryClient + Devtools. | Devtools only in dev. |
| `EditorialTopbar` | `components/editorial-topbar.tsx` | (Defined but unused — see Dead Code.) | Maps pathname → display title. |
| `ComingSoon` | `components/coming-soon.tsx` | (Defined but unused.) | Generic placeholder card. |

### 7.4 Pure Lib Helpers

- `src/lib/utils.ts` — `cn(...inputs)` = `twMerge(clsx(...))`.
- `src/lib/format-date.ts` — `parseDateLocal(value)` (parses YYYY-MM-DD as local date), `formatDateOnly(value, opts?)` (cached `Intl.DateTimeFormat`, default `"MMM dd, yyyy"`-ish; returns "—" on null/undefined; falls back to raw on parse failure).
- `src/lib/format-money.ts` — `formatCurrency(value, currency)` (cached `Intl.NumberFormat` per currency, 2 decimals); `formatMoneyPlain(value)` (no currency, 2 decimals).
- `src/lib/query-client.ts` — `makeQueryClient()` with defaults: `staleTime: 5 min`, `gcTime: 10 min`, `refetchOnWindowFocus: false`, `refetchOnMount: false`, `retry: 1` (mutations: `retry: 0`).
- `src/lib/auth-mode.ts` — `AUTH_DISABLED` flag, `DEV_USER_EMAIL = "dev@local"`.
- `src/lib/constants.ts` — All bucket names, file size/MIME limits, badge classes, packaging type labels.
- `src/lib/supabase/{client,server,types}.ts` — Browser/server Supabase clients + shared TypeScript types (`Contact`, `Account`, ... + enums).
- `src/lib/proforma/istanbul-date.ts` — `istanbulYYYYMMDD`, `formatOfferDateShort`, `todayIsoDate`, `addDaysIso`, `istanbulYearMonth`, `shiftYearMonth`.
- `src/lib/proforma/offer-number.ts` — `generateOfferNumber(supabase, offerDateIso)`.
- `src/lib/proforma/proforma-money.ts` — `formatProformaMoney(amount, currency)` (fr-FR locale, narrow no-break space normalization), `formatProformaQty(qty)`.
- `src/lib/proforma/incoterm-options.ts` — Array constant: `["EXW Istanbul", "FOB Istanbul", "CIF Douala", "CIF Abidjan", "CIF Conakry", "CIF Dakar", "CIF Nouakchott", "CIF Lagos", "DAP", "FCA", "CPT", "CIP", "DDP", "DPU"]`. Default: `"EXW Istanbul"`.
- `src/lib/proforma/payment-terms-options.ts` — `["Cash payment", "Net 30 days", "50% advance, 50% on delivery", "100% advance"]`. Default: `"Cash payment"`.
- `src/lib/proforma/schema.ts` — `proformaFormSchema` (Zod). All fields optional, trimmed, empty → null. Date fields validated `^\d{4}-\d{2}-\d{2}$` ("Use YYYY-MM-DD"). `getMissingProformaFields(source)` checks `offer_date`/`incoterm`/`payment_terms`, returns array like `["Offer date", "Incoterm", "Payment terms"]`.
- `src/lib/shipments/dimensions.ts` — `packageCbm(line)`, `effectiveCbmPerUnit(line)`, `derivedCbmPerUnit(line)`, `lineTotals(line)`, `aggregateShipmentTotals(orders)`, `containerFillSummary(type, totals)`. Container capacities: 20DC=33.2 m³ / 28200 kg, 40DC=67.7 / 28800, 40HC=76.4 / 28600, 40RF=67.0 / 27000. Soft-warning load factor: 0.85.
- `src/lib/ledger/fifo-allocation.ts` — `allocateFifo(events, displayCurrency)` (Section 4.5).
- `src/lib/ledger/installment-allocation.ts` — `allocateInstallments(installments, receipts, today)` (Section 4.7).
- `src/lib/ledger/partner-reimbursement-allocation.ts` — `allocatePartnerReimbursementFifo(claims, payouts)` (Section 4.8).
- `src/lib/ledger/kdv-summary.ts` — `summarizeKdv(transactions, monthsBack, now)` (Section 4.4).
- `src/hooks/use-mobile.ts` — `useIsMobile()` boolean (768px breakpoint, uses `useSyncExternalStore` over `window.matchMedia`).


---

## 8. File Handling & Document Generation

### 8.1 Upload Flow (deferred-upload pattern)

All forms that take a file follow the same pattern (illustrated by orders/products/transactions/shipments):

1. The **target row's UUID is generated client-side** before insert, so the storage path can be `{entity_id}/...` without a chicken-and-egg.
2. The user picks a file in the form. The file is held in memory; preview uses `URL.createObjectURL()`.
3. On form submit, the entity row is inserted, then the file is uploaded to storage, then the row is updated with the storage path.
4. On form cancel, nothing was uploaded — no orphans.
5. On row delete, the file is removed from storage (best-effort).

### 8.2 Buckets and constants

From `src/lib/constants.ts`:

```
PRODUCT_IMAGE_BUCKET           = "product-photos"
TRANSACTION_ATTACHMENT_BUCKET  = "transaction-attachments"
ORDER_ATTACHMENT_BUCKET        = "order-attachments"
SHIPMENT_DOCUMENTS_BUCKET      = "shipment-documents"
SHIPMENT_INVOICE_BUCKET        = "shipment-invoices"

MAX_PRODUCT_IMAGE_BYTES         = 5 * 1024 * 1024
MAX_TRANSACTION_ATTACHMENT_BYTES = 5 * 1024 * 1024
MAX_ORDER_ATTACHMENT_BYTES      = 5 * 1024 * 1024
MAX_SHIPMENT_DOCUMENT_BYTES     = 5 * 1024 * 1024

ACCEPTED_PRODUCT_IMAGE_TYPES         = ["image/jpeg","image/png","image/webp"]
ACCEPTED_TRANSACTION_ATTACHMENT_TYPES = ["image/jpeg","image/png","image/webp","application/pdf"]
ACCEPTED_ORDER_ATTACHMENT_TYPES      = ["image/jpeg","image/png","image/webp","application/pdf"]
ACCEPTED_SHIPMENT_DOCUMENT_TYPES     = ["image/jpeg","image/png","image/webp","application/pdf"]
```

Path conventions:
- `product-photos/{product_id}/{filename}`
- `transaction-attachments/{transaction_id}/{filename}`
- `order-attachments/{order_id}/{type}/{filename}` where `type ∈ {customer_po, proposal}`
- `shipment-documents/{shipment_id}/{timestamp}.{ext}` (single file column — replace, not append)
- `shipment-invoices/{shipment_id}/statement-{unix_timestamp}.pdf` (regeneration writes a new key; old versions retained as audit trail; `shipments.generated_statement_pdf` always points to the newest)

### 8.3 Download Flow

All file access uses **signed URLs** (1-hour expiry by default): `supabase.storage.from(bucket).createSignedUrl(path, 3600, { download?: filename })`.

Functions:
- `productImageUrl(path)` — public URL (bucket allows public reads via policy).
- `transactionAttachmentSignedUrl(path, expiresIn?, downloadFilename?)`
- `orderAttachmentSignedUrl(path, expiresIn?, downloadFilename?)`
- `shipmentDocumentSignedUrl(path, expiresIn?)`

### 8.4 PDF Documents

PDFs are generated via `@react-pdf/renderer` v4.5.1. Two documents:

1. **Proforma invoice** — bilingual French/English, French-primary.
2. **Shipment statement** — bilingual French/English, French-primary.

#### 8.4.1 Font Registration

`src/lib/pdf/font-registration.ts` registers fonts conditionally:

- **Browser:** Activated only when `NEXT_PUBLIC_PDF_FONTS_AVAILABLE === "true"`. Loads from public path.
- **Node:** Activated when `PDF_FONTS_DIR` env var points to a directory containing all required TTFs. `fs.existsSync()` probe — silent fallback if any missing.
- When unavailable, falls back to the built-in WinAnsi fonts: Helvetica, Helvetica-Bold, Helvetica-Oblique, Times-Roman, Times-Italic, Courier, Courier-Bold.

Required TTFs (in `public/fonts/` for browser): Inter-Regular, Inter-Bold, Inter-Italic, InstrumentSerif-Regular, InstrumentSerif-Italic, JetBrainsMono-Regular, JetBrainsMono-Bold.

`Font.registerHyphenationCallback((word) => [word])` — disables hyphenation globally.

`pdfFontsAvailable` is a boolean export driving font choice across components.

#### 8.4.2 Text Encoding (`text-encoding.ts`)

When `pdfFontsAvailable=false`, the function `pdfText(input)` transliterates non-WinAnsi characters to nearest Latin equivalents (Turkish, Polish, Czech/Slovak, Hungarian, Romanian, Croatian/Bosnian/Serbian). Otherwise pass-through.

Examples: ş→s, ı→i, ğ→g, ç→c, ö→o, ü→u (Turkish); ą→a, ć→c, ę→e, ł→l, ń→n, ś→s, ź→z, ż→z (Polish); č→c, ď→d, ě→e, ň→n, ř→r, š→s, ť→t, ů→u, ý→y, ž→z (Czech/Slovak); ő→o, ű→u (Hungarian); ă→a, â→a, î→i, ț→t (Romanian); đ→d (Croatian/Bosnian/Serbian).

#### 8.4.3 Logo

`pdf-assets.ts` exports `PDF_BRAND_LOGO_SRC`:
- Browser: `/logo.png` (served by Next).
- Node: `process.env.PDF_LOGO_OVERRIDE` (absolute path).

#### 8.4.4 Shared Styles (`shared-styles.ts`)

OKLCH-derived hex colors:
- `PAPER` `#FAF7F0` (background)
- `PANEL` `#F4EFE6`, `ZEBRA` `#F2EDE2` (alternating rows)
- `INK` `#2C2926` (text)
- `MUTED` `#6B6963`, `DIM` `#8E8B83`
- `HAIRLINE` `#D8D2C5`, `RULE` `#2C2926`
- `BRICK` `#A4452C` (warm accent)
- `BRAND_RED` `#D71920` (brand mark only)
- `POSITIVE` `#4A8B3F` (green credit)

Page: A4. Padding 40 / 44 / 44 / 44 (top/right/bottom/left). Body font 9 pt INK. Background PAPER.

Shared style constants cover letterhead, title block, key-value rows, table headers, table body cells, monospace cells (for fiscal numbers), section headers, dividers, and footers.

#### 8.4.5 Proforma PDF

**Files:** `proforma-pdf.tsx` (Document root), `proforma-pdf-header.tsx`, `proforma-pdf-client-offer-block.tsx`, `proforma-pdf-line-table.tsx`, `proforma-pdf-notes-block.tsx`, `proforma-pdf-types.ts`, `proforma-pdf-styles.ts`.

**Header content (verbatim):**
- Brand banner: logo centered (height 42pt, width 168pt).
- Letterhead row, two columns:
  - Left kicker: `"EXPÉDITEUR · FROM"` followed by company name (bold), address1, address2, `"T {phone} · E {email}"`, optional `"VKN {taxId} · {taxOffice} V.D."` or `"VKN {taxId}"`.
  - Right kicker: `"N° OFFRE"` then offer number (mono bold 11pt), then `"Émis le {DD.MM.YYYY}"` and `"Valable jusqu'au {DD.MM.YYYY}"`.
- Title block (bordered): `"PROFORMA"` (serif 28pt) with italic accent `"Invoice"` (BRICK color); subtitle `"OFFRE COMMERCIALE"` (sans-bold 8pt MUTED, letter-spacing 2pt).

**Client / Offer block (two columns):**
- Left header `"CLIENT · BILL TO"`. Party name (bold 12pt). KV rows: `CONTACT`, `ADRESSE`, `PAYS`, `N° FISCAL` (mono).
- Right header `"DÉTAILS DE L'OFFRE"`. KV rows: `DEVISE`, `INCOTERM`, `LIVRAISON`, `PAIEMENT`.

**Line table** — header: `N° | DÉSIGNATION | PHOTO | UNITÉ | QTÉ | PRIX U. | TOTAL`. Per row: line number (center), product name (bold) + optional description (muted), product photo (56×56pt or dashed placeholder), unit, quantity (`formatProformaQty`), unit price (`formatProformaMoney`), bold mono line total. Alternating zebra rows.

**Grand total row:** label `"GRAND TOTAL"` (sans-bold 9pt MUTED), value (serif 22pt BRICK) = sum of line totals.

**Notes block** (only rendered if any note set): KV pairs with labels `REMARQUE`, `VALIDITÉ`, `LIVRAISON`, `PRODUCTION`, `TOLÉRANCE`, `POIDS TOTAL`.

**Document metadata:**
- title: `"Proforma {offerNumber} — {customerCompanyName}"`
- author: company name
- subject: `"Proforma invoice {offerNumber} for {customerCompanyName}"`
- keywords: `"proforma, invoice, {offerNumber}, {customerCompanyName}"`
- creator/producer: `"{companyName} ERP"`

**Fixed footer:** `"Turc Global · {offerNumber}"` and `"Page {n} / {total}"`.

**Storage path:** `order-attachments/{order_id}/proposal/{offer_number}.pdf`. Generation function: `generateProformaPdf(orderId)` returns `{ path, signedUrl, offerNumber }`. Filename built via `buildProformaPdfFilename`.

#### 8.4.6 Shipment Statement PDF

**Files:** `shipment-statement-pdf.tsx`, `shipment-statement-pdf-header.tsx`, `shipment-statement-pdf-client-shipment-block.tsx`, `shipment-statement-pdf-line-table.tsx`, `shipment-statement-pdf-payments-block.tsx`, `shipment-statement-pdf-footer.tsx`, `shipment-statement-pdf-types.ts`, `shipment-statement-pdf-styles.ts`.

**Header:** Brand banner. Letterhead (same left col). Right col: `"N° ENVOI"` then shipment name (mono bold 11pt) then `"ETD {DD.MM.YYYY}"` / `"ETA {DD.MM.YYYY}"`. Title block: `"RELEVÉ"` (serif 28pt) with italic accent `"d'envoi"` (BRICK); subtitle `"SHIPMENT STATEMENT"`.

**Client / Shipment block:**
- Left: `"CLIENT · BILL TO"` (same as proforma).
- Right: `"DÉTAILS DE L'ENVOI"`. KV rows: `CONTAINER`, `TRACKING`, `DEVISE`.

**Line table** — header: `N° | PRODUIT | QTÉ | PRIX UNIT. | TOTAL | STATUT`. Status cell:
- `"new"` → `"Nouveau"` (INK 9pt).
- `"rolled_over"` → `"Facturé sur {rolledOverToName}"` or `"Facturé ailleurs"` (MUTED 9pt).
- `"cancelled"` → `"Annulé"` (MUTED 9pt, line-through).

`unit_price` and `line_total` are `null` (rendered "—") for rolled-over/cancelled lines.

**Totals block:** `"Sous-total marchandise"` (sum of new lines only) + `"Fret maritime ({containerType})"` or `"Fret maritime"` (if freight > 0) + `"GRAND TOTAL"` (serif 20pt BRICK).

**Payments block:**
- Section header `"PAIEMENTS REÇUS · PAYMENTS RECEIVED"`.
- Empty state: `"Aucun paiement reçu pour le moment."` (italic MUTED).
- Table: `DATE | DESCRIPTION | MONTANT`. Per row: `formatOfferDateShort(date)`, description (defaults to `"Paiement reçu"`), optional partial annotation (`"(attribué partiellement à TG-…, …)"` italic), `formatProformaMoney(allocatedAmount, currency)`.
- `"Total reçu"` row.

**Balance block:**
- balance > 0 → label `"SOLDE DÛ"`, value (serif 24pt BRICK).
- balance < 0 → label `"CRÉDIT EN FAVEUR"`, value (serif 24pt POSITIVE).
- balance == 0 → label `"SOLDE"`, value (serif 24pt MUTED).

**Footer notes** (conditional):
- If `hasSkippedCurrencyEvents`: `"Note : certains paiements en devises étrangères ne figurent pas sur ce relevé ; veuillez nous contacter pour réconciliation."` (italic MUTED).
- If `isBillingStale`: `"Note interne : le montant facturé est en cours de rafraîchissement."` (italic MUTED).

**Document metadata:**
- title: `"Statement {shipmentName} — {customerCompanyName}"`
- subject/keywords parallel.

**Storage path:** `shipment-invoices/{shipment_id}/statement-{unix_timestamp}.pdf` (upsert: false; old versions retained). Filename via `buildStatementPdfFilename`.

**Data assembly:**
- Fetch shipment + customer.
- Find the billing transaction (`shipment_billing` row for this shipment) — throws if missing.
- Fetch all `order_details` for orders in the shipment, sorted `(order_date, order_id, line_number)`.
- Cross-reference other shipment names for rolled-over annotations.
- Run FIFO allocation across the customer's transactions; filter payment allocations to those with `related_shipment_id = thisShipmentId`.
- Build partial-allocation annotation when a payment hits multiple shipments.
- Compute `isBillingStale = (billingTxn.amount !== computeShipmentTotal(...))`.
- `hasSkippedCurrencyEvents = (fifo.skipped_events.length > 0)`.

### 8.5 KDV CSV Export

**File:** `src/features/tax/csv.ts`.

- Function: `buildKdvCsv(rows, period) → { csv, tryCount, skippedCount }`.
- Filter rows to the given period and TRY currency.
- Format: `;`-separated (Turkish Excel locale), UTF-8 BOM prepended.
- **Header block** (single-cell rows, semicolon-quoted):
  - `KDV Beyannamesi;{period}`
  - `Dönem;{period}`
  - `Hazırlanma tarihi;{todayIsoDate()}`
  - `İşlenen satır;{tryCount}`
  - `Atlanan satır (TRY dışı veya KDV yok);{skippedCount}`
  - blank line
- **Column headers** (Turkish):
  ```
  Tarih;İşlem türü;Yön;Karşı taraf;Belge no;Açıklama;Para birimi;Matrah (Net);KDV oranı;KDV tutarı
  ```
- **Data rows:** `transaction_date | kind label | "Tahsil edilen"/"Ödenen" | contact_or_partner_name | reference_number | description | currency | net_amount | vat_rate | vat_amount`. RFC 4180 quoting.
- **Footer totals:**
  - `Toplam tahsil edilen KDV;{net};{vat}`
  - `Toplam ödenen KDV;{net};{vat}`
  - `Net ödenecek / devreden KDV;{net}`

**Filename:** `KDV_{period}_TurcGlobal.csv` from `buildKdvCsvFilename` (in `src/lib/pdf/document-filenames.ts`).

### 8.6 Document Filenames (`src/lib/pdf/document-filenames.ts`)

Constraints:
- No Windows-illegal chars (`/\:*?"<>|`), no control chars or spaces.
- Diacritics folded to ASCII (Turkish + extended Latin).
- Bounded at 255 chars.

Helpers:
- `slugifyForFilename(input, maxLen=32)` — fold, replace illegal with `-`, collapse runs, trim, return `"Untitled"` if empty.
- `safeDocumentNumber(raw)` — preserves dashes; replaces illegal/whitespace with dashes; collapses runs.
- `isoDate(raw)` — extracts YYYY-MM-DD from ISO timestamp; null otherwise.
- `buildProformaPdfFilename(offerNumber, customerName, offerDate)` → `"Proforma_2026-04-25_TG-2026-0042_acme-trade.pdf"`.
- `buildStatementPdfFilename(shipmentName, customerName, etdDate)` → `"Statement_2026-04-20_TG-2026-SHIP-001_global-imports.pdf"`.
- `buildKdvCsvFilename(period)` → `"KDV_2026-04_TurcGlobal.csv"`.


---

## 9. Integrations

### 9.1 Supabase (Postgres + Auth + Storage)

- **URL:** From `NEXT_PUBLIC_SUPABASE_URL`. Project ref `tpskndvtagnoklpfrusu` (per `supabase/config.toml`).
- **Auth:** `@supabase/ssr` for cookie-based sessions (server + browser clients).
- **Postgres:** All tables under `public` schema; RLS disabled (app-gate only).
- **Storage:** Five private buckets (Section 8.2). Signed-URL access (1 h default expiry).
- **Edge function `refresh-rates`:** `verify_jwt = true`. Reachable by pg_cron (using service-role key from Vault) or by the manual button (browser → service role key NOT used; the manual path uses the same `refreshFxSnapshots`/`refreshPriceSnapshots` from `src/features/treasury/refresh-engine.ts` directly via the browser client).
- **pg_cron + pg_net:** Schedule `refresh-rates-weekday-morning` runs `0 6 * * 1-5` UTC (= 09:00 weekday Istanbul). Body POSTs to the function URL with `Authorization: Bearer <service_role_key>` from `vault.decrypted_secrets`.

### 9.2 Frankfurter (FX rates)

- **Base URL:** `https://api.frankfurter.dev/v1`
- **Endpoints used:** `GET /latest?from={code}&to=USD` (one call per non-USD fiat code in active accounts).
- **Auth:** None (public).
- **Failure handling:** Per-currency error captured into `fx_outcome.errors[]`. Validation: `rate_to_usd` must be > 0 and finite.
- **Source value stored:** `"frankfurter.dev"` in `fx_snapshots.source`.

### 9.3 CoinPaprika (crypto prices)

- **Base URL:** `https://api.coinpaprika.com/v1`
- **Endpoint:** `GET /tickers/{id}`. The full id is looked up in the hardcoded `COINPAPRIKA_IDS` map (20 entries — see Section 3.4.1). Asset codes not in the map are skipped (returned in `price_outcome.skipped`).
- **Auth:** None (public).
- **Failure handling:** Per-asset error captured.
- **Source value stored:** `"coinpaprika.com"` in `price_snapshots.source`.

### 9.4 Gold-API (precious metals)

- **Base URL:** `https://api.gold-api.com/price`
- **Endpoint:** `GET /{metal}` for `gold` or `silver`.
- **Unit conversion:** Returned price is USD/oz; if asset code maps to a gram unit (Altın, Altın(gr), Gümüş, Gümüş(gr)), divide by `OZ_TO_GRAM = 31.1034768`.
- **Source value stored:** `"gold-api.com"`.

### 9.5 Vercel

- Hosting + deploys (auto from GitHub `main`).
- Environment variables set via Project Settings → Environment Variables.

### 9.6 No Other Integrations

There is no email service, no analytics, no Sentry/error tracker, no Stripe, no SMS, no webhook delivery, no third-party file storage. All storage is Supabase. All analytics/monitoring is the rate-refresh audit table.

---

## 10. Authentication & Authorization

### 10.1 Sign-In (Magic Link)

1. User visits `/login`. Form prompts for email.
2. On submit, `supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: "${origin}/auth/callback?next=${next}" } })` is called.
3. Supabase emails a magic link.
4. User clicks the link → lands on `/auth/callback?code=…&next=/…`.
5. `GET /auth/callback` calls `supabase.auth.exchangeCodeForSession(code)`. On success, redirect to `${origin}${next}` (default `/dashboard`).
6. On failure, redirect to `/login?error=auth_callback_failed`.

### 10.2 Session Refresh

- The `proxy.ts` middleware runs on every request (matcher excludes static assets and image extensions).
- If `AUTH_DISABLED=true`, passes through immediately.
- Otherwise builds a Supabase server client wired to request/response cookies and calls `getUser()`. This implicitly refreshes the JWT and updates cookies via `setAll`.
- Unauthenticated requests to non-public paths → redirect `/login?next=<path>`.
- Authenticated requests to `/login` → redirect `/dashboard`.

### 10.3 Sign-Out

- The sidebar footer's UserMenu contains a `<form action="/auth/signout" method="post">` with a "Sign out" button.
- `POST /auth/signout` calls `supabase.auth.signOut()` and `303` redirects to `/login`.

### 10.4 Authorization Model

- **No roles, no permissions.** Single-tenant, owner-managed. The auth gate is the only authorization control.
- **No multi-tenancy:** There is no `tenant_id` or workspace concept on any table. The single Supabase project belongs to Turc Global.
- **`AUTH_DISABLED` dev bypass:** Set `NEXT_PUBLIC_DISABLE_AUTH=true` to short-circuit the gate. Mutations stamp `created_by`/`edited_by` as `null`. Sidebar shows `dev@local`. Must remain unset (or `false`) in production.

### 10.5 Server-Side Auth (mutations)

- `currentUserId()` helper (used in mutations) calls `supabase.auth.getUser()` from the browser client. If no user and `AUTH_DISABLED`, returns `null`. Otherwise throws `"Not authenticated"`.

### 10.6 RLS

All tables have RLS disabled (`alter table … disable row level security`). The plan (per migration comments) is to re-enable module-by-module in a future production-auth pass. Until then, the app-gate is the only data-access boundary.

---

## 11. Internationalization

### 11.1 Languages Supported

- **App UI:** **English-only**. No translation framework, no locale switching, no `next-intl` / `react-intl`. All labels, errors, and placeholders are hardcoded English strings.
- **Generated PDFs (`src/lib/pdf/`):** **French-primary** (with English bilingual subtitles). All section headers, labels, and notes are in French (e.g. `RELEVÉ d'envoi`, `SOLDE DÛ`, `Aucun paiement reçu pour le moment.`). See Section 8 for verbatim text.
- **Turkish domain terms** preserved verbatim throughout the codebase: Kasa, Ortak, Şirket, Vergi Dairesi, Yükleme Talimatı, KDV, Altın, Gümüş, BEYAN.
- **Turkish-language CSV (KDV export):** Headers and totals in Turkish (`KDV Beyannamesi`, `Dönem`, `Tarih`, `İşlem türü`, `Tahsil edilen`, `Ödenen`, `Toplam tahsil edilen KDV`).
- **Country names:** `countries` table stores both `name_en` and `name_tr` plus `flag_emoji`. The country picker uses `name_en`.

### 11.2 Locale Detection

- No locale detection — `Intl.NumberFormat` and `Intl.DateTimeFormat` are constructed with `undefined` locale, deferring to the user's browser/system locale for date/number formatting.
- Cached formatters (per currency, per options) avoid repeated construction overhead.

### 11.3 Date / Number / Currency Formatting

- **Dates:** `formatDateOnly(value, opts?)` defaults to `{ year: "numeric", month: "short", day: "2-digit" }` → e.g. "Apr 25, 2026" (browser-locale-dependent).
- **Currency (general):** `formatCurrency(value, currency)` uses `Intl.NumberFormat(undefined, { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 })`.
- **Money (PDF, French):** `formatProformaMoney(amount, currency)` uses `fr-FR` locale (e.g. `"1 234,56 €"`); narrow no-break spaces (U+202F) and no-break spaces (U+00A0) are normalized to regular spaces for PDF compatibility.
- **Quantity (PDF):** `formatProformaQty(qty)` uses `fr-FR` locale, 0–2 decimals.
- **TRY (P&L, KDV):** `formatTryFull` (`"₺2,025.00"`), `formatTryShort` (`"₺2025"`), `formatTryCompact` (`"₺2.94M"` or `"₺412K"`). Negatives use minus sign U+2212.
- **Editorial date:** `formatLongDate` ("Saturday, 25 April 2026"), `formatShortDate` ("24 Apr"), `formatFooterTimestamp` ("25.04.2026 · 09:14").
- **Period strings:** `istanbulYearMonth(date)` returns `YYYY-MM` in Istanbul timezone (UTC+3, no DST).

### 11.4 Right-to-Left

Not supported. `components.json` has `"rtl": false`.

---

## 12. Non-Functional Details

### 12.1 Logging Strategy

- **Browser:** `console.warn` / `console.error` for unexpected query failures (e.g. `rate_refresh_runs` table missing). User-facing failures show toasts (Sonner).
- **Edge function:** Errors captured into `rate_refresh_runs.error_message`; per-leg outcomes into `fx_outcome` / `price_outcome` JSONs.
- **No structured logging service.** No Sentry, no Logtail, no Vercel logs are scraped — debugging is via the browser devtools and Supabase function logs.

### 12.2 Error Handling Patterns

- **Mutations:** Always throw on Supabase error; React Query's `onError` triggers Sonner toast. Many mutations have explicit rollback (e.g. `createOrder` deletes the order if line inserts fail; `markOccurrencePaid` undoes movement and transaction if occurrence insert fails).
- **Queries:** React Query default `retry: 1`; `refetchOnMount: false`, `refetchOnWindowFocus: false`. Hard failures surface as `<ErrorTile>` with manual "Retry" button (dashboard) or per-component error states.
- **`(app)/error.tsx`:** App-level error boundary — generic "Something went wrong" with "Try again" / "Reload" actions.
- **`(app)/loading.tsx`:** Skeleton-based loading state.
- **Form errors:** Zod errors display inline below each field via React Hook Form's `formState.errors`.
- **Cross-row business invariants:** Some are DB-enforced (CHECK constraints, partial unique indexes), some are mutation-enforced (transfer guard, cancellation gate, status-advance gate). Quoted error messages live alongside the throws.

### 12.3 Performance Considerations

- **TanStack Query staleness:** 5-minute stale, 10-minute GC. No window-focus or remount refetches.
- **Cached `Intl` formatters:** `Map`-based caches avoid expensive `new Intl.NumberFormat()` per render across hundreds of ledger rows.
- **Pure ledger functions:** FIFO/installment/reimbursement/KDV summarizers are pure and run on every render. They're cheap (linear in event count) but if they ever become hot, memoization is straightforward.
- **Database indexes:** Listed per table in Section 2 — most importantly `accounts_active_idx`, `transactions_kind_idx`, `transactions_transaction_date_idx`, `orders_status_idx`, `shipments_status_idx`, `uniq_shipment_accrual`, `accounts_unique_active_name_idx`.
- **Picker chokepoint filter:** All account pickers filter on `deleted_at IS NULL AND is_active = true`. This pattern is mirrored for contacts.
- **Pagination:** None implemented. Most lists are limited by org size (< 1000 rows per table expected for this single-tenant deployment).
- **Lazy materialization:** Recurring payment "pending" rows are derived, not stored.
- **No request-time data fetching besides auth:** Pages render client components that own their queries; Next renders the shell quickly.
- **Turbopack dev:** Faster local dev rebuilds.
- **`outputFileTracingExcludes`:** `next.config.ts` excludes `assets/`, `handoff/`, `supabase/`, `scripts/` from build trace to keep deploy size lean.

### 12.4 Security

- **Input sanitization:** All form inputs validated by Zod (server-side validation N/A since mutations are client-side). Supabase JS client uses parameterized queries — no SQL injection surface.
- **XSS:** React's default escaping; no `dangerouslySetInnerHTML` used.
- **CSRF:** Not specifically defended; Supabase auth uses cookies with `SameSite=Lax` (default).
- **Rate limiting:** None at app layer. Supabase has built-in protection on auth endpoints.
- **Service-role key leakage:** Strictly excluded from `NEXT_PUBLIC_*`. Used only by `scripts/e2e-walk.ts` audits and by pg_cron through Vault.
- **PII:** Customer email/phone/address/tax_id stored in `contacts`. No special encryption beyond Postgres at-rest defaults.
- **File uploads:** MIME type and size enforced client-side (5 MB cap; PDF/JPEG/PNG/WebP only depending on bucket). Bucket-level policies allow authenticated read/write.
- **Magic-link:** Single-use, time-bound. The redirect URL must be allowlisted in Supabase Auth settings.

### 12.5 Background Jobs / Scheduled Tasks

- **`refresh-rates-weekday-morning`** pg_cron job (`0 6 * * 1-5` UTC = 09:00 weekday Istanbul). Calls the `refresh-rates` edge function via pg_net using a service-role JWT from Vault. Logs every run to `rate_refresh_runs`.
- **No other scheduled jobs.** No queues, no workers.

### 12.6 Tests

- Custom test runner (`scripts/run-tests.mjs`) — discovers `src/**/*.test.{ts,tsx}`, runs each via `tsx`, parses `N passed, M failed` line.
- Tests are pure (no DB/network/FS). Each defines local `assertEq`/`section` helpers.
- Coverage areas (from `find ... *.test.ts`):
  - `src/lib/format-date.test.ts`
  - `src/lib/format-money.test.ts`
  - `src/lib/ledger/fifo-allocation.test.ts`
  - `src/lib/ledger/installment-allocation.test.ts`
  - `src/lib/ledger/kdv-summary.test.ts`
  - `src/lib/ledger/partner-reimbursement-allocation.test.ts`
  - `src/lib/pdf/document-filenames.test.ts`
  - `src/lib/proforma/istanbul-date.test.ts`
  - `src/lib/proforma/proforma-money.test.ts`
  - `src/lib/proforma/schema.test.ts`
  - `src/lib/shipments/dimensions.test.ts`
  - `src/features/dashboard/attention-rules.test.ts`
  - `src/features/dashboard/editorial-format.test.ts`
  - `src/features/orders/proforma-helpers.test.ts`
  - `src/features/orders/proforma-import-schema.test.ts`
  - `src/features/partners/queries/pending-reimbursements.test.ts`
  - `src/features/partners/queries/psd-summary.test.ts`
  - `src/features/profit-loss/queries.test.ts`
  - `src/features/profit-loss/resolve-rate.test.ts`
  - `src/features/shipments/billing.test.ts`
  - `src/features/tax/csv.test.ts`
  - `src/features/transactions/schema.test.ts`
- **End-to-end walkthroughs:** `scripts/e2e-walk.ts` (2,688 lines) and `scripts/edge-cases.ts` (1,889 lines) — run against a dev database (refuse to run on production), require `SUPABASE_SERVICE_ROLE_KEY` for cross-RLS reads, drive every module via the same code paths the UI uses, then clean up rows. `scripts/preflight-snapshot.mjs` snapshots row counts before/after for leak detection.


---

## 13. Dead Code / Unused

The following exist in the codebase but appear to have no live usage. Verified via grep for imports/JSX usage in the application tree.

| Item | File | Status |
|---|---|---|
| `<EditorialTopbar />` | `src/components/editorial-topbar.tsx` | Defined; no import found in `src/app/(app)/layout.tsx` or any page. The `(app)` layout renders only `AppSidebar` + `SidebarInset`. The component still exists, presumably as a candidate for a future "broadsheet-style" header. |
| `<ComingSoon />` | `src/components/coming-soon.tsx` | Defined; no import found. Was used by module placeholders in the early scaffold; all modules now have full implementations. |
| Removed transaction kinds | `transactions.kind` CHECK no longer accepts `'order_billing'`, `'other_expense'`, `'adjustment'`. CHECK rejects them, but the names still appear in old commit history and `decisions.md`. |
| `transactions.related_order_id` column | `transactions` schema | Declared but unconstrained (no FK). Reserved for a future order-level billing flow that was never built. |
| `transactions.revenue_source` column | (was) `transactions` schema | Dropped in `20260428160000_drop_revenue_source.sql`. Mentioned in earlier `decisions.md` entries. |
| `transactions.fx_target_currency`, `fx_converted_amount`, `fx_rate_applied` | Used only on `client_payment` rows where the payment currency differs from the customer's `balance_currency`. Other kinds leave them null. |
| `accounts.subtype`, `accounts.bank_name`, `accounts.iban`, `accounts.shares` | All optional, used opportunistically per asset_type. |
| `proforma_pdf-styles.ts` "legacy maroon" alias `ZEBRA` | `shared-styles.ts` | Comment notes it's a legacy alias. Kept for back-compat. |

`transactions_kdv_period_only_on_tax_payment` and `transactions_kdv_period_shape` are CHECK constraints — not dead, just enforced silently.

The `assets/`, `handoff/`, and `samples/` directories are excluded from the production build via `outputFileTracingExcludes`.

---

## 14. Open Questions (NEEDS CLARIFICATION)

These items could not be fully resolved from the code alone. A developer rebuilding the system should resolve them by reading `decisions.md` (164KB append-only log) or asking the product owner.

1. ⚠️ **Stale FX UX:** `treasury.md` states the plan is to "grey out the USD column when rates are > 24h old (threshold tunable)". The constant `FX_STALE_MS = 24h` exists, and `useLastRefreshRun` is consumed by the Treasury header for the staleness pill, but the per-row USD greying behavior on the holdings list could not be confirmed from the read I performed of `treasury-index.tsx`. Verify in `treasury-index.tsx` if/how this conditional styling is applied to individual rows.

2. ⚠️ **Sample data files** under `scripts/sample-data/` (`company.ts`, `kdv-samples.ts`, `proforma-samples.ts`, `statement-samples.ts`) and `scripts/render-sample-pdfs.tsx` were enumerated but not deeply read. Their detailed shape (e.g. number of fixtures per file, exact realism of Turkish names) was inferred from the shape of related types.

3. ⚠️ **Shipment freight allocation across multiple orders:** When a shipment with N orders advances to `booked`, `shipment_billing` and `shipment_cogs` are created per order, but the spec mentions only one `shipment_freight` row per shipment. Whether the `freight_cost` is allocated *proportionally per order* vs. attached as a single shipment-level accrual requires a closer look at `src/features/shipments/billing.ts`. The `uniq_shipment_accrual` index is on `(related_shipment_id, kind)` — i.e. one of each kind per shipment — which suggests one freight accrual per shipment, not per order.

4. ⚠️ **Refresh engine — manual button code path:** The browser-side `useRefreshRatesMutation()` exists and reuses the same engine code as the edge function, but I did not confirm whether it logs `triggered_by='manual'` to `rate_refresh_runs` from the browser (or whether it bypasses logging entirely). Verify in `src/features/treasury/refresh-engine.ts`.

5. ⚠️ **Customer balance currency vs. order currency mismatch:** When a customer's `balance_currency = 'EUR'` but the order is in 'USD', is the FIFO allocator running on the EUR converted amounts, or is the order's accrual already produced in EUR? The code shows `effectiveAmount` skips events whose currency doesn't match `displayCurrency` and lacks a frozen `fx_converted_amount`. For shipment_billing accruals (which don't use FX freeze), this means orders in a different currency than the customer's `balance_currency` would skip — flagged as `'no_fx'`. Verify intent.

6. ⚠️ **Custody locations — pre-repo seeds:** The "Şirket / Ortak / Kasa" custody locations referenced in `treasury.md` and the auto-set `requires_movement_type=true` on "Ortak" suggest these were inserted by a pre-repo migration. The current `20260422120000_treasury_movements.sql` runs `update public.custody_locations set requires_movement_type = true where name = 'Ortak'`, implying the row already existed. The exact pre-repo seeding script is not in the repo.

7. ⚠️ **Order billing on cancellation:** `cancelOrder` calls `refreshShipmentBilling` on `previous billing_shipment_id` if it existed, then NULLs both shipment FKs. But what happens if the cancelled order was the *only* order on the shipment — do the accrual rows for that shipment get deleted entirely or just zeroed? Verify in `src/features/shipments/billing.ts`.

8. ⚠️ **Sidebar `/dashboard` and `/tax` discoverability:** Neither route appears in the sidebar's nav groups. `/dashboard` is the post-login landing (and shown via the `Building2`/`LineChart`-adjacent rows? — verify). `/tax` is reachable only from the dashboard's KDV attention items. Confirm the intended UX is "/dashboard is bookmark-only" and "/tax is dashboard-only" or if they should be linked from the sidebar.

9. ⚠️ **Decisions.md content:** The 164KB log was sampled (~30 high-impact decisions extracted by the exploration agent), but the full list contains many more entries. Treat the embedded summary in Section 4 as illustrative; consult `decisions.md` for the complete set.

10. ⚠️ **`recurring_payments` / `recurring_payment_occurrences` interaction with bank reconciliation:** When a recurring payment is "marked paid", a transaction row and movement spawn. If the user later edits/deletes that transaction directly (not through the recurring panel), the `ON DELETE SET NULL` on `recurring_payment_occurrences.transaction_id` keeps the occurrence row. Confirm the UI handles this orphan correctly (the History drawer should still show "Paid" with no link).

11. ⚠️ **Custody location naming (`GAP 1`, `Kasa Çekme`):** Mentioned in `treasury.md` as off-site physical gold locations. They appear to be data, not code; verify whether they were ever seeded or are user-added.

12. ⚠️ **The `proxy.ts` matcher** excludes `*.{svg,png,jpg,jpeg,gif,webp}` paths. Any other static assets (e.g. PDFs in `/public`) are NOT excluded. Confirm intent (this is actually fine because PDFs aren't served from `/public`; they're signed-URL'd from Storage).

---

# End of Specification

