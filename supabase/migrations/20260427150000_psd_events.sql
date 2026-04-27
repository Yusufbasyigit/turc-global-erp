-- PSD events: parent rows for profit-share distributions. Each event can hold
-- multiple legs (one per currency / source account), stored as profit_distribution
-- transactions linked back via psd_event_id. partner_id is intentionally never
-- set on PSD legs — Yusuf wants 'how much left the company', not 'who got what'.
-- Run in the Supabase dashboard SQL editor.

CREATE TABLE public.psd_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_date date NOT NULL,
  fiscal_period text NULL,
  note text NULL,
  deleted_at timestamptz NULL,
  created_by text NULL,
  created_time timestamptz NOT NULL DEFAULT now(),
  edited_by text NULL,
  edited_time timestamptz NULL
);
CREATE INDEX psd_events_event_date_idx ON public.psd_events(event_date);
ALTER TABLE public.psd_events DISABLE ROW LEVEL SECURITY;

ALTER TABLE public.transactions
  ADD COLUMN psd_event_id uuid NULL
    REFERENCES public.psd_events(id) ON DELETE CASCADE;
CREATE INDEX transactions_psd_event_id_idx
  ON public.transactions(psd_event_id);

-- A profit_distribution row must belong to a PSD event and cannot be tied
-- to a partner. All other kinds must leave psd_event_id null.
ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_profit_distribution_psd_event
    CHECK (
      (kind = 'profit_distribution' AND psd_event_id IS NOT NULL AND partner_id IS NULL)
      OR
      (kind <> 'profit_distribution' AND psd_event_id IS NULL)
    );
