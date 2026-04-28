-- Drop revenue_source from transactions. real_estate_deal_id (FK to
-- real_estate_deals) is now the sole source of truth for "is this
-- real-estate revenue?". The CHECK constraint on revenue_source is dropped
-- automatically with the column.

DROP INDEX IF EXISTS public.transactions_revenue_source_idx;

ALTER TABLE public.transactions
  DROP COLUMN IF EXISTS revenue_source;
