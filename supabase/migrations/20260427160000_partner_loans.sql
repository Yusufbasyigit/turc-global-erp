-- Partner loans (company -> partner). Distinguishes loan transactions from
-- reimbursement payouts so the FIFO reimbursement allocator does not consume
-- them. Loans are single-leg: the disbursement transaction itself is the
-- loan record; expected installments live in loan_installments.
-- Run in the Supabase dashboard SQL editor.

ALTER TABLE public.transactions
  ADD COLUMN is_loan boolean NOT NULL DEFAULT false;

CREATE INDEX transactions_is_loan_idx ON public.transactions(is_loan)
  WHERE is_loan = true;

ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_is_loan_kind
    CHECK (
      is_loan = false
      OR (kind IN ('partner_loan_out','partner_loan_in') AND partner_id IS NOT NULL)
    );

CREATE TABLE public.loan_installments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_transaction_id uuid NOT NULL
    REFERENCES public.transactions(id) ON DELETE CASCADE,
  due_date date NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  currency text NOT NULL,
  created_time timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX loan_installments_loan_id_idx
  ON public.loan_installments(loan_transaction_id);
CREATE INDEX loan_installments_due_date_idx
  ON public.loan_installments(due_date);
ALTER TABLE public.loan_installments DISABLE ROW LEVEL SECURITY;
