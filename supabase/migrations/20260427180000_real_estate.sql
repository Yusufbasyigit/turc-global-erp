-- Real estate: a second business line. Receipts reuse the existing
-- client_payment kind (no new transaction kind); a deal_id FK links a
-- payment to a deal so installment status can be FIFO-allocated.
-- A revenue_source column tags rows for the P&L "real-estate vs rest" split.
-- Run in the Supabase dashboard SQL editor.

-- 1. Deals: parent record for a single rent agreement or sale contract.
--    Single-currency by design (parallel deals if needed). Free-text label —
--    no normalized property registry; "Şişli daire kira" is the identity.
CREATE TABLE public.real_estate_deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  sub_type text NOT NULL CHECK (sub_type IN ('rent','sale')),
  contact_id uuid NOT NULL REFERENCES public.contacts(id),
  currency text NOT NULL CHECK (currency IN ('TRY','EUR','USD','GBP')),
  start_date date NOT NULL,
  notes text NULL,
  deleted_at timestamptz NULL,
  created_by text NULL,
  created_time timestamptz NOT NULL DEFAULT now(),
  edited_by text NULL,
  edited_time timestamptz NULL
);
CREATE INDEX real_estate_deals_contact_id_idx
  ON public.real_estate_deals(contact_id);
CREATE INDEX real_estate_deals_start_date_idx
  ON public.real_estate_deals(start_date);
-- Case-insensitive unique label among non-deleted deals (mirrors accounts).
CREATE UNIQUE INDEX real_estate_deals_label_unique
  ON public.real_estate_deals(lower(label))
  WHERE deleted_at IS NULL;
ALTER TABLE public.real_estate_deals DISABLE ROW LEVEL SECURITY;

-- 2. Installments: expected payment schedule. CASCADE on deal delete.
CREATE TABLE public.real_estate_installments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL
    REFERENCES public.real_estate_deals(id) ON DELETE CASCADE,
  due_date date NOT NULL,
  expected_amount numeric NOT NULL CHECK (expected_amount > 0),
  sequence int NOT NULL,
  created_time timestamptz NOT NULL DEFAULT now(),
  UNIQUE (deal_id, sequence)
);
CREATE INDEX real_estate_installments_deal_id_idx
  ON public.real_estate_installments(deal_id);
CREATE INDEX real_estate_installments_due_date_idx
  ON public.real_estate_installments(due_date);
ALTER TABLE public.real_estate_installments DISABLE ROW LEVEL SECURITY;

-- 3. Link transactions to a deal. Only client_payment rows can carry a
--    deal_id (defence-in-depth: an expense or loan can't be mistagged).
ALTER TABLE public.transactions
  ADD COLUMN real_estate_deal_id uuid NULL
    REFERENCES public.real_estate_deals(id);
CREATE INDEX transactions_real_estate_deal_id_idx
  ON public.transactions(real_estate_deal_id)
  WHERE real_estate_deal_id IS NOT NULL;
ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_real_estate_deal_kind
    CHECK (
      real_estate_deal_id IS NULL
      OR kind = 'client_payment'
    );

-- 4. Revenue source tag for the P&L split. Defaults from contact.type at
--    write time in the mutation layer; null on legacy rows is treated as
--    'export' by the P&L predicate. The CHECK keeps values constrained but
--    stays nullable so existing rows are not affected.
ALTER TABLE public.transactions
  ADD COLUMN revenue_source text NULL
    CHECK (revenue_source IS NULL OR revenue_source IN ('real_estate','export'));
CREATE INDEX transactions_revenue_source_idx
  ON public.transactions(revenue_source)
  WHERE revenue_source IS NOT NULL;

-- 5. The contacts.type column is plain text (no enum), so adding a new
--    'real_estate' value is a no-op at the DB layer — the application's
--    CONTACT_TYPES const is the source of truth. Documenting here for
--    future readers.
