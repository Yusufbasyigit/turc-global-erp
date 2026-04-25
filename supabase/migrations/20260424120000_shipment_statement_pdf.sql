-- Shipment statement PDF — Wave 3c+ client-facing document.
-- Adds a pointer column for the latest generated statement PDF, and a new
-- private storage bucket that holds historical versions (one per regeneration,
-- keyed by unix timestamp so nothing is overwritten).

ALTER TABLE public.shipments
  ADD COLUMN IF NOT EXISTS generated_statement_pdf text;

-- Storage bucket — manual step in the Supabase dashboard:
--   Storage → New bucket → name: "shipment-invoices", visibility: Private
--     Policies: allow authenticated read/write.
--     Path convention in code: {shipment_id}/statement-{unix_timestamp}.pdf
--     Regeneration writes a new object; prior versions are preserved as a
--     free audit trail. `shipments.generated_statement_pdf` always points at
--     the newest path.
