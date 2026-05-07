-- Seed default product categories. The product form's "Category" combobox
-- reads from public.product_categories; inline-create remains available for
-- ad-hoc additions. Idempotent via WHERE NOT EXISTS (no unique constraint on
-- name, so ON CONFLICT can't be used).

INSERT INTO public.product_categories (name)
SELECT v.name
FROM (VALUES
  ('Food & Beverage'),
  ('Textiles & Apparel'),
  ('Furniture & Home Goods'),
  ('Electronics & Appliances'),
  ('Machinery & Equipment'),
  ('Construction & Building Materials'),
  ('Personal Care & Cosmetics')
) AS v(name)
WHERE NOT EXISTS (
  SELECT 1 FROM public.product_categories e WHERE e.name = v.name
);
