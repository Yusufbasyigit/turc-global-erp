-- Transactions foundation: drop V1, add partners, redesigned transactions,
-- and link treasury_movements back via source_transaction_id.
-- Run this in the Supabase dashboard SQL editor. Do not run locally with
-- `supabase db push` — schema is applied manually.

-- 1. Drop V1 transactions. CASCADE removes the self-reference
-- (related_payable_id) and any FKs that pointed at the old table.
DROP TABLE IF EXISTS public.transactions CASCADE;

-- 2. Partners — minimal table. No balance_currency; no running balance.
CREATE TABLE public.partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  deleted_at timestamptz NULL,
  created_by text NULL,
  created_time timestamptz NOT NULL DEFAULT now(),
  edited_by text NULL,
  edited_time timestamptz NULL
);
ALTER TABLE public.partners DISABLE ROW LEVEL SECURITY;

INSERT INTO public.partners (name)
VALUES ('Partner 1'), ('Partner 2'), ('Partner 3');

-- 3. Redesigned transactions table.
CREATE TABLE public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_date date NOT NULL,
  kind text NOT NULL CHECK (kind IN (
    'client_payment','client_refund',
    'supplier_payment','supplier_invoice',
    'expense','other_income','other_expense',
    'partner_loan_in','partner_loan_out','profit_distribution',
    'tax_payment','order_billing','adjustment'
  )),
  amount numeric NOT NULL CHECK (amount > 0),
  currency text NOT NULL,
  description text NULL,
  from_account_id uuid NULL REFERENCES public.accounts(id),
  to_account_id uuid NULL REFERENCES public.accounts(id),
  contact_id uuid NULL REFERENCES public.contacts(id),
  partner_id uuid NULL REFERENCES public.partners(id),
  -- Order/shipment links: uuid-shaped for the future. No FK yet — the orders
  -- module is unbuilt and shipments.shipment_id is still text.
  related_order_id uuid NULL,
  related_shipment_id uuid NULL,
  expense_type_id uuid NULL REFERENCES public.expense_types(id),
  vat_rate numeric NULL,
  vat_amount numeric NULL,
  net_amount numeric NULL,
  fx_rate_applied numeric NULL,
  fx_target_currency text NULL,
  fx_converted_amount numeric NULL,
  reference_number text NULL,
  attachment_path text NULL,
  created_by text NULL,
  created_time timestamptz NOT NULL DEFAULT now(),
  edited_by text NULL,
  edited_time timestamptz NULL,
  -- Exactly one of (contact_id, partner_id) may be set; both null is fine.
  CHECK ((contact_id IS NULL) OR (partner_id IS NULL))
);
CREATE INDEX transactions_transaction_date_idx
  ON public.transactions(transaction_date);
CREATE INDEX transactions_kind_idx ON public.transactions(kind);
CREATE INDEX transactions_contact_id_idx ON public.transactions(contact_id);
CREATE INDEX transactions_partner_id_idx ON public.transactions(partner_id);
ALTER TABLE public.transactions DISABLE ROW LEVEL SECURITY;

-- 4. Link movements back to their source transaction. Null for standalone
-- movements (openings, transfers, trades, manual adjustments).
ALTER TABLE public.treasury_movements
  ADD COLUMN source_transaction_id uuid NULL
    REFERENCES public.transactions(id) ON DELETE SET NULL;
CREATE INDEX treasury_movements_source_transaction_id_idx
  ON public.treasury_movements(source_transaction_id);

-- 5. Storage bucket — manual step in the Supabase dashboard:
--    Storage → New bucket → name: "transaction-attachments", visibility: Private
--    Then on the bucket's Policies tab, allow authenticated read/write.
--    Path convention in code: {transaction_id}/{filename}
