-- Defensive currency CHECK constraints. The Zod layer in
-- src/features/shipments/schema.ts and src/features/orders/schema.ts already
-- restricts these columns to BALANCE_CURRENCIES = ('TRY','EUR','USD','GBP'),
-- but the DB itself accepts anything. A direct SQL write or a stale client
-- could plant a typo (e.g. 'UZZ') that would later produce NaN / missing FX
-- rates downstream.
--
-- Use NOT VALID so the migration succeeds even if historical rows happen to
-- violate the rule. New writes and updates are enforced immediately. Run
-- `ALTER TABLE ... VALIDATE CONSTRAINT ...` later (manually) once the data
-- is known clean.

ALTER TABLE public.shipments
  ADD CONSTRAINT shipments_freight_currency_check
  CHECK (freight_currency IS NULL OR freight_currency IN ('TRY','EUR','USD','GBP'))
  NOT VALID;

ALTER TABLE public.shipments
  ADD CONSTRAINT shipments_invoice_currency_check
  CHECK (invoice_currency IN ('TRY','EUR','USD','GBP'))
  NOT VALID;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_order_currency_check
  CHECK (order_currency IN ('TRY','EUR','USD','GBP'))
  NOT VALID;
