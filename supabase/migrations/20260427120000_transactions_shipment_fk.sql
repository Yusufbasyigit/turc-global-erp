-- Add the missing FK from transactions.related_shipment_id to shipments.id.
-- The column has existed as an unconstrained uuid since the transactions
-- foundation migration (see 20260423120000) — the orders/shipments rebuild
-- comment explicitly flagged it as "uuid-shaped but unconstrained (no FKs
-- yet)". Declaring the FK lets PostgREST embed shipments in a single query
-- (eliminating the N+1 in listTransactionsForContact) and enforces the
-- integrity that the mutation layer already assumes.

-- Defensive cleanup: NULL out any orphan references before declaring the FK.
-- Without this, the constraint would fail to create if pre-FK rows pointed to
-- a since-deleted shipment.
UPDATE public.transactions
SET related_shipment_id = NULL
WHERE related_shipment_id IS NOT NULL
  AND related_shipment_id NOT IN (SELECT id FROM public.shipments);

-- Idempotent: the constraint may have been added manually via the SQL editor
-- before this migration landed (the original file was tagged "Run this in the
-- Supabase dashboard SQL editor"). Skip if it already exists.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'transactions_related_shipment_id_fkey'
      AND conrelid = 'public.transactions'::regclass
  ) THEN
    ALTER TABLE public.transactions
      ADD CONSTRAINT transactions_related_shipment_id_fkey
      FOREIGN KEY (related_shipment_id)
      REFERENCES public.shipments(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS transactions_related_shipment_id_idx
  ON public.transactions(related_shipment_id);
