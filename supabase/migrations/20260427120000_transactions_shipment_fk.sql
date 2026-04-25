-- Add the missing FK from transactions.related_shipment_id to shipments.id.
-- The column has existed as an unconstrained uuid since the transactions
-- foundation migration (see 20260423120000) — the orders/shipments rebuild
-- comment explicitly flagged it as "uuid-shaped but unconstrained (no FKs
-- yet)". Declaring the FK lets PostgREST embed shipments in a single query
-- (eliminating the N+1 in listTransactionsForContact) and enforces the
-- integrity that the mutation layer already assumes.
-- Run this in the Supabase dashboard SQL editor. Do not run locally with
-- `supabase db push` — schema is applied manually.

ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_related_shipment_id_fkey
  FOREIGN KEY (related_shipment_id)
  REFERENCES public.shipments(id)
  ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS transactions_related_shipment_id_idx
  ON public.transactions(related_shipment_id);
