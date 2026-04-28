-- R7 from transaction-types-audit.md: remove the `order_billing` transaction
-- kind. It was reserved for a future order-level billing flow that never
-- shipped; shipment-level billing (introduced 2026-04-27) covers all current
-- revenue accruals. No code path ever produced an `order_billing` row.
--
-- Defensive: if any rows somehow exist with `kind='order_billing'` the
-- migration aborts so they can be investigated rather than silently dropped.

-- 1. Defensive guard — abort if any order_billing rows exist.
DO $$
DECLARE
  n integer;
BEGIN
  SELECT count(*) INTO n FROM public.transactions WHERE kind = 'order_billing';
  IF n > 0 THEN
    RAISE EXCEPTION 'Refusing to drop order_billing: % rows exist with that kind. Investigate before re-running.', n;
  END IF;
END $$;

-- 2. Tighten transactions_kind_check (drop `order_billing` from the allowed
-- list). Allowed list copied from 20260428120000_collapse_other_expense.sql
-- minus 'order_billing'.
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_kind_check;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_kind_check
  CHECK (kind IN (
    'client_payment','client_refund',
    'supplier_payment','supplier_invoice',
    'expense','other_income',
    'partner_loan_in','partner_loan_out','profit_distribution',
    'tax_payment','shipment_billing',
    'shipment_cogs','shipment_freight'
  ));
