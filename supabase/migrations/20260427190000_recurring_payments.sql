-- Recurring monthly payments. Two tables:
--   1. recurring_payments — the templates (rent, accounting firm, sahibinden,
--      subscriptions, etc.). Open-ended by default; pause/resume per template.
--   2. recurring_payment_occurrences — one row per resolved month (paid or
--      skipped). Pending months are derived: a template with no occurrence
--      row for the current period is "due."
--
-- Auto-creating a transaction is the app's job (mark-paid mutation creates
-- the transaction and then the occurrence with transaction_id linked).
--
-- Apply with `supabase db push` from the CLI (the standard workflow in
-- CLAUDE.md). The CLI prompts for confirmation each time.

-- 1. Templates.
CREATE TABLE public.recurring_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NULL,
  -- Transaction kind that gets auto-created on mark-paid. Defaults to
  -- 'expense' which fits 95% of recurring payments. Power users can pick
  -- other_expense, supplier_payment, etc.
  kind text NOT NULL DEFAULT 'expense' CHECK (kind IN (
    'expense','other_expense','supplier_payment','tax_payment'
  )),
  expected_amount numeric NOT NULL CHECK (expected_amount > 0),
  currency text NOT NULL CHECK (currency IN ('TRY','EUR','USD','GBP')),
  -- 1..31. Months with fewer days clamp to the last day in app code.
  day_of_month int NOT NULL CHECK (day_of_month BETWEEN 1 AND 31),
  account_id uuid NOT NULL REFERENCES public.accounts(id),
  contact_id uuid NULL REFERENCES public.contacts(id),
  expense_type_id uuid NULL REFERENCES public.expense_types(id),
  -- First month this template should appear. Defaults to first-of-month at
  -- creation time in app code; can be backdated or future-dated.
  effective_from date NOT NULL,
  end_date date NULL,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','paused')),
  notes text NULL,
  deleted_at timestamptz NULL,
  created_by text NULL,
  created_time timestamptz NOT NULL DEFAULT now(),
  edited_by text NULL,
  edited_time timestamptz NULL
);
CREATE INDEX recurring_payments_status_idx
  ON public.recurring_payments(status)
  WHERE deleted_at IS NULL;
CREATE INDEX recurring_payments_account_id_idx
  ON public.recurring_payments(account_id);
CREATE INDEX recurring_payments_contact_id_idx
  ON public.recurring_payments(contact_id);
ALTER TABLE public.recurring_payments DISABLE ROW LEVEL SECURITY;

-- 2. Occurrences. Lazy materialization: a row exists only when paid or
--    skipped. (template_id, year, month) is unique to prevent duplicates.
CREATE TABLE public.recurring_payment_occurrences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recurring_payment_id uuid NOT NULL
    REFERENCES public.recurring_payments(id) ON DELETE CASCADE,
  period_year int NOT NULL,
  period_month int NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  status text NOT NULL CHECK (status IN ('paid','skipped')),
  paid_amount numeric NULL CHECK (paid_amount IS NULL OR paid_amount > 0),
  paid_date date NULL,
  -- ON DELETE SET NULL: if the user deletes the spawned transaction, the
  -- occurrence row stays so the month doesn't accidentally re-appear as
  -- pending (they can still undo via the recurring panel to clear it).
  transaction_id uuid NULL
    REFERENCES public.transactions(id) ON DELETE SET NULL,
  notes text NULL,
  created_by text NULL,
  created_time timestamptz NOT NULL DEFAULT now(),
  edited_by text NULL,
  edited_time timestamptz NULL,
  UNIQUE (recurring_payment_id, period_year, period_month)
);
CREATE INDEX recurring_payment_occurrences_period_idx
  ON public.recurring_payment_occurrences(period_year, period_month);
CREATE INDEX recurring_payment_occurrences_transaction_id_idx
  ON public.recurring_payment_occurrences(transaction_id);
ALTER TABLE public.recurring_payment_occurrences DISABLE ROW LEVEL SECURITY;
