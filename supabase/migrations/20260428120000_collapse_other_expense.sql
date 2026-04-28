-- R1 from transaction-types-audit.md: collapse `other_expense` into `expense`.
--
-- `other_expense` and `expense` shared Dr/Cr (Dr Expense · Cr Bank), the same
-- P&L bucket (EXPENSE_KINDS), and the same KDV treatment. The only signal the
-- kind split was carrying was "expense_type_id is unset" — that is a category,
-- not a kind. Collapse the two and seed an `Uncategorized` row in
-- `expense_types` so previously-`other_expense` rows have a non-null category
-- after backfill. `expense_type_id` stays nullable; the form enforces a pick.

-- 1. Seed `Uncategorized` (idempotent — `expense_types.name` has no unique
-- constraint, mirror the WHERE NOT EXISTS pattern from
-- 20260427200000_seed_expense_types.sql).
INSERT INTO public.expense_types (name, is_active)
SELECT 'Uncategorized', true
WHERE NOT EXISTS (
  SELECT 1 FROM public.expense_types e WHERE e.name = 'Uncategorized'
);

-- 2. Backfill transactions. First: rows with no category get the sentinel.
UPDATE public.transactions
SET expense_type_id = (
  SELECT id FROM public.expense_types WHERE name = 'Uncategorized' LIMIT 1
)
WHERE kind = 'other_expense' AND expense_type_id IS NULL;

-- Then: rewrite the kind. Catches any rows that already had a category
-- (data drift — schema didn't allow it but we're defensive).
UPDATE public.transactions
SET kind = 'expense'
WHERE kind = 'other_expense';

-- 3. Backfill recurring_payments templates. Single statement: COALESCE the
-- category to the sentinel and rewrite the kind in one pass.
UPDATE public.recurring_payments
SET
  expense_type_id = COALESCE(
    expense_type_id,
    (SELECT id FROM public.expense_types WHERE name = 'Uncategorized' LIMIT 1)
  ),
  kind = 'expense'
WHERE kind = 'other_expense';

-- 4. Tighten transactions_kind_check (drop `other_expense` from the allowed
-- list). Allowed list copied from 20260427210000_drop_transaction_adjustment_kind.sql
-- minus 'other_expense'.
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_kind_check;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_kind_check
  CHECK (kind IN (
    'client_payment','client_refund',
    'supplier_payment','supplier_invoice',
    'expense','other_income',
    'partner_loan_in','partner_loan_out','profit_distribution',
    'tax_payment','order_billing','shipment_billing',
    'shipment_cogs','shipment_freight'
  ));

-- 5. Tighten recurring_payments_kind_check. Original allowed list at
-- 20260427190000_recurring_payments.sql:22-24 was inline (unnamed in source
-- but Postgres named it `recurring_payments_kind_check` by convention).
ALTER TABLE public.recurring_payments DROP CONSTRAINT IF EXISTS recurring_payments_kind_check;
ALTER TABLE public.recurring_payments ADD CONSTRAINT recurring_payments_kind_check
  CHECK (kind IN (
    'expense','supplier_payment','tax_payment'
  ));
