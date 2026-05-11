-- scripts/reset-data.sql
--
-- ARCHIVAL — DO NOT RUN. Already executed once, on 2026-05-11, as the
-- pre-launch data cutover when the app went live with real company data.
-- The SQL below is preserved in the repo as a record of what was wiped
-- that day; it is NOT a reusable utility. Running it now would destroy
-- real business data.
--
-- That cutover wiped: transactions, treasury_movements, orders,
-- order_details, shipments, psd_events, loan_installments,
-- real_estate_installments, recurring_payment_occurrences, audit_log,
-- accounts, contacts, contact_notes, products, product_categories,
-- expense_types, recurring_payments, real_estate_deals, price_snapshots.
--
-- It kept: countries, fx_snapshots, ticker_registry, monthly_fx_overrides,
-- rate_refresh_runs, app_settings, the 3 real partners, and the 3 real
-- custody_locations (Şirket / Ortak / Kasa). A follow-up DELETE in the
-- SQL editor that same day trimmed two placeholder partners + one "Test"
-- partner + two extra custody_locations (Binance, Kuveyt Türk) that
-- weren't covered by the original keep-list.
--
-- After truncate, it re-seeded the 6 expense_types and 7
-- product_categories defaults so the app's forms remained populated.

BEGIN;

TRUNCATE TABLE
  public.accounts,
  public.audit_log,
  public.contact_notes,
  public.contacts,
  public.expense_types,
  public.loan_installments,
  public.order_details,
  public.orders,
  public.price_snapshots,
  public.product_categories,
  public.products,
  public.psd_events,
  public.real_estate_deals,
  public.real_estate_installments,
  public.recurring_payment_occurrences,
  public.recurring_payments,
  public.shipments,
  public.transactions,
  public.treasury_movements
RESTART IDENTITY CASCADE;

-- Re-seed expense_types (5 original from 20260427200000_seed_expense_types.sql
-- + Uncategorized from 20260428120000_collapse_other_expense.sql).
INSERT INTO public.expense_types (name, is_active)
SELECT v.name, true
FROM (VALUES
  ('Marketing & Sales'),
  ('Operations & Logistics'),
  ('Subscriptions & Software'),
  ('Professional Services'),
  ('Office & General/Transit'),
  ('Uncategorized')
) AS v(name)
WHERE NOT EXISTS (
  SELECT 1 FROM public.expense_types e WHERE e.name = v.name
);

-- Re-seed product_categories (from 20260504120000_seed_product_categories.sql).
INSERT INTO public.product_categories (name)
SELECT v.name
FROM (VALUES
  ('Food & Beverage'),
  ('Textiles & Apparel'),
  ('Furniture & Home Goods'),
  ('Electronics & Appliances'),
  ('Machinery & Equipment'),
  ('Construction & Building Materials'),
  ('Personal Care & Cosmetics')
) AS v(name)
WHERE NOT EXISTS (
  SELECT 1 FROM public.product_categories e WHERE e.name = v.name
);

-- Verification: shows row counts for every kept table + the re-seeded ones.
-- Expected: countries ~200+, partners 3, custody_locations 3, app_settings 1,
-- expense_types 6, product_categories 7. Rate tables preserve whatever was
-- there before.
SELECT 'countries'                       AS table_name, count(*) AS row_count FROM public.countries
UNION ALL SELECT 'partners',                            count(*) FROM public.partners
UNION ALL SELECT 'custody_locations',                   count(*) FROM public.custody_locations
UNION ALL SELECT 'app_settings',                        count(*) FROM public.app_settings
UNION ALL SELECT 'fx_snapshots',                        count(*) FROM public.fx_snapshots
UNION ALL SELECT 'ticker_registry',                     count(*) FROM public.ticker_registry
UNION ALL SELECT 'monthly_fx_overrides',                count(*) FROM public.monthly_fx_overrides
UNION ALL SELECT 'rate_refresh_runs',                   count(*) FROM public.rate_refresh_runs
UNION ALL SELECT 'expense_types (re-seeded)',           count(*) FROM public.expense_types
UNION ALL SELECT 'product_categories (re-seeded)',      count(*) FROM public.product_categories
ORDER BY table_name;

COMMIT;
