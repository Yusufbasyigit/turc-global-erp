-- Orders, order_details, shipments rebuild — Wave 1.
-- Drops V1 tables entirely (no production data, all test rows) and creates
-- the redesigned schema from the Session 2 spec. Also adds products.hs_code
-- and extends transactions.kind CHECK with 'shipment_billing'.
-- Run this in the Supabase dashboard SQL editor. Do not run locally with
-- `supabase db push` — schema is applied manually.

-- 1. Drop V1 tables with CASCADE. `transactions.related_order_id` and
--    `transactions.related_shipment_id` are uuid-shaped but unconstrained
--    (no FKs yet), so nothing else needs to be touched.
DROP TABLE IF EXISTS public.order_status_history CASCADE;
DROP TABLE IF EXISTS public.order_details CASCADE;
DROP TABLE IF EXISTS public.orders CASCADE;
DROP TABLE IF EXISTS public.shipments CASCADE;

-- 2. Shipments — groups one or more orders physically and financially.
CREATE TABLE public.shipments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.contacts(id),
  name text NOT NULL,
  tracking_number text NULL,
  transport_method text NULL CHECK (transport_method IN ('sea','road','air','other')),
  container_type text NULL,
  vessel_name text NULL,
  etd_date date NULL,
  eta_date date NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','booked','in_transit','arrived')),
  freight_cost numeric NULL,
  freight_currency text NULL,
  invoice_currency text NOT NULL,
  notes text NULL,
  documents_file text NULL,
  created_by text NULL,
  created_time timestamptz NOT NULL DEFAULT now(),
  edited_by text NULL,
  edited_time timestamptz NULL
);
CREATE INDEX shipments_customer_id_idx ON public.shipments(customer_id);
CREATE INDEX shipments_status_idx ON public.shipments(status);
CREATE INDEX shipments_etd_date_idx ON public.shipments(etd_date);
ALTER TABLE public.shipments DISABLE ROW LEVEL SECURITY;

-- 3. Orders — six-status lifecycle with cancellation off-ramp.
--    `shipment_id` is physical location; `billing_shipment_id` is financial
--    (defaults to match on assignment; may diverge for rolled-over orders).
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.contacts(id),
  order_date date NOT NULL DEFAULT current_date,
  order_currency text NOT NULL,
  status text NOT NULL DEFAULT 'inquiry'
    CHECK (status IN (
      'inquiry','quoted','accepted','in_production',
      'shipped','delivered','cancelled'
    )),
  shipment_id uuid NULL REFERENCES public.shipments(id),
  billing_shipment_id uuid NULL REFERENCES public.shipments(id),
  notes text NULL,
  customer_po_file text NULL,
  proposal_pdf text NULL,
  cancelled_at timestamptz NULL,
  cancellation_reason text NULL,
  created_by text NULL,
  created_time timestamptz NOT NULL DEFAULT now(),
  edited_by text NULL,
  edited_time timestamptz NULL,
  CHECK ((status = 'cancelled') = (cancelled_at IS NOT NULL))
);
CREATE INDEX orders_customer_id_idx ON public.orders(customer_id);
CREATE INDEX orders_status_idx ON public.orders(status);
CREATE INDEX orders_order_date_idx ON public.orders(order_date);
CREATE INDEX orders_shipment_id_idx ON public.orders(shipment_id);
CREATE INDEX orders_billing_shipment_id_idx ON public.orders(billing_shipment_id);
ALTER TABLE public.orders DISABLE ROW LEVEL SECURITY;

-- 4. Order details — one row per order line, full product snapshot,
--    overridable packaging per line, per-line supplier.
CREATE TABLE public.order_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(product_id),
  line_number int NOT NULL,
  product_name_snapshot text NOT NULL,
  product_description_snapshot text NULL,
  product_photo_snapshot text NULL,
  unit_snapshot text NOT NULL,
  cbm_per_unit_snapshot numeric NULL,
  weight_kg_per_unit_snapshot numeric NULL,
  quantity numeric NOT NULL,
  unit_sales_price numeric NULL,
  est_purchase_unit_price numeric NULL,
  actual_purchase_price numeric NULL,
  vat_rate numeric NULL,
  supplier_id uuid NULL REFERENCES public.contacts(id),
  packaging_type text NULL,
  package_length_cm numeric NULL,
  package_width_cm numeric NULL,
  package_height_cm numeric NULL,
  units_per_package numeric NULL,
  notes text NULL,
  created_by text NULL,
  created_time timestamptz NOT NULL DEFAULT now(),
  edited_by text NULL,
  edited_time timestamptz NULL
);
CREATE UNIQUE INDEX order_details_order_line_idx
  ON public.order_details(order_id, line_number);
CREATE INDEX order_details_order_id_idx ON public.order_details(order_id);
CREATE INDEX order_details_product_id_idx ON public.order_details(product_id);
ALTER TABLE public.order_details DISABLE ROW LEVEL SECURITY;

-- 5. HS code on products — populated opportunistically from Wave 2 proforma
--    imports, editable manually via the product form.
ALTER TABLE public.products ADD COLUMN hs_code text NULL;

-- 6. Add 'shipment_billing' to transactions.kind CHECK. `order_billing` stays
--    for backward compatibility; new code won't write it.
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_kind_check;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_kind_check
  CHECK (kind IN (
    'client_payment','client_refund',
    'supplier_payment','supplier_invoice',
    'expense','other_income','other_expense',
    'partner_loan_in','partner_loan_out','profit_distribution',
    'tax_payment','order_billing','shipment_billing','adjustment'
  ));

-- 7. Storage buckets — manual steps in the Supabase dashboard:
--    Storage → New bucket → name: "order-attachments", visibility: Private
--      Policies: allow authenticated read/write.
--      Path convention in code: {order_id}/{type}/{timestamp}.{ext}
--      where type ∈ {'customer_po','proposal'}.
--    Storage → New bucket → name: "shipment-documents", visibility: Private
--      Policies: allow authenticated read/write.
--      Path convention: {shipment_id}/{timestamp}.{ext}
