-- Remove the manually-added "Office Supplies" expense type. It overlaps with
-- the seeded "Office & General/Transit" bucket. Any existing transactions
-- referencing it are repointed to NULL (uncategorized) so the delete succeeds
-- regardless of FK behavior.

WITH target AS (
  SELECT id FROM public.expense_types WHERE name = 'Office Supplies'
)
UPDATE public.transactions
SET expense_type_id = NULL
WHERE expense_type_id IN (SELECT id FROM target);

UPDATE public.recurring_payments
SET expense_type_id = NULL
WHERE expense_type_id IN (
  SELECT id FROM public.expense_types WHERE name = 'Office Supplies'
);

DELETE FROM public.expense_types WHERE name = 'Office Supplies';
