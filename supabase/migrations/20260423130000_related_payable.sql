-- Wave 2: optional link from supplier_payment rows back to a specific
-- supplier_invoice row. Self-referential FK on public.transactions.
-- Run this in the Supabase dashboard SQL editor. Do not run locally with
-- `supabase db push` — schema is applied manually.

ALTER TABLE public.transactions
  ADD COLUMN related_payable_id uuid NULL
    REFERENCES public.transactions(id) ON DELETE SET NULL;

-- Same-row invariant: the link may only be set on supplier_payment rows.
-- The cross-row rule (referenced row must be a supplier_invoice for the same
-- contact) is enforced in the mutation layer, not here.
ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_related_payable_only_on_payment_chk
  CHECK (related_payable_id IS NULL OR kind = 'supplier_payment');

CREATE INDEX transactions_related_payable_id_idx
  ON public.transactions(related_payable_id);
