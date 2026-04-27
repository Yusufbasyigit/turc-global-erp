-- Seed default expense categories. The transaction form's "Expense type"
-- combobox reads from public.expense_types; users can still create custom
-- categories on the fly, but these five cover the company's recurring buckets.
-- Idempotent: WHERE NOT EXISTS skips rows already present (the table has no
-- unique constraint on name, so we can't rely on ON CONFLICT).

INSERT INTO public.expense_types (name, is_active)
SELECT v.name, true
FROM (VALUES
  ('Marketing & Sales'),
  ('Operations & Logistics'),
  ('Subscriptions & Software'),
  ('Professional Services'),
  ('Office & General/Transit')
) AS v(name)
WHERE NOT EXISTS (
  SELECT 1 FROM public.expense_types e WHERE e.name = v.name
);
