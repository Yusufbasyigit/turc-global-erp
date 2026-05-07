-- Defensive currency CHECK constraints, follow-up to
-- 20260505130000_currency_check_constraints.sql which only covered
-- shipments and orders. The canonical `transactions.currency` column
-- (highest-write-volume currency field in the system) and
-- `loan_installments.currency` were both missed and accept any text.
--
-- Same NOT VALID strategy as the previous migration: the rule applies to
-- new writes immediately, leaving any historical-data validation for a
-- deliberate later `VALIDATE CONSTRAINT` run once the data is known clean.

ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_currency_check
  CHECK (currency IN ('TRY','EUR','USD','GBP'))
  NOT VALID;

ALTER TABLE public.loan_installments
  ADD CONSTRAINT loan_installments_currency_check
  CHECK (currency IN ('TRY','EUR','USD','GBP'))
  NOT VALID;
