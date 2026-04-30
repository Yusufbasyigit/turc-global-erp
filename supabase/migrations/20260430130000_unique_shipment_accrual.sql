-- Enforce one accrual per (shipment, kind) for the three shipment accrual
-- kinds. The mutation layer in src/features/shipments/billing.ts already
-- assumes uniqueness (findShipmentTransaction uses .maybeSingle()), but
-- there's no DB-level guard. Two rapid clicks on "Advance to Booked" or a
-- retry after a network flake can each succeed and leave the shipment with
-- duplicate billing/cogs/freight rows — silently double-counting revenue
-- and breaking findShipmentTransaction.
--
-- Partial unique index because non-shipment kinds have no related_shipment_id
-- and would conflict with each other on the NULL value otherwise.

DO $$
DECLARE
  duplicate_count integer;
BEGIN
  SELECT COUNT(*)
  INTO duplicate_count
  FROM (
    SELECT related_shipment_id, kind, COUNT(*) AS n
    FROM public.transactions
    WHERE kind IN ('shipment_billing','shipment_cogs','shipment_freight')
      AND related_shipment_id IS NOT NULL
    GROUP BY related_shipment_id, kind
    HAVING COUNT(*) > 1
  ) dups;

  IF duplicate_count > 0 THEN
    RAISE EXCEPTION
      'Cannot enforce unique (related_shipment_id, kind): % shipment(s) already have duplicate accrual rows. Resolve duplicates manually before applying this migration.',
      duplicate_count;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_shipment_accrual
  ON public.transactions (related_shipment_id, kind)
  WHERE kind IN ('shipment_billing','shipment_cogs','shipment_freight')
    AND related_shipment_id IS NOT NULL;
