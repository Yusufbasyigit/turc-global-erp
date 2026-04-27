-- Add shipment_cogs and shipment_freight transaction kinds.
--
-- These are written automatically alongside shipment_billing when a shipment
-- transitions draft -> booked, so a shipment's full net profit (sales - cogs
-- - freight) lands in the booking month for monthly P&L purposes.

ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_kind_check;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_kind_check
  CHECK (kind IN (
    'client_payment','client_refund',
    'supplier_payment','supplier_invoice',
    'expense','other_income','other_expense',
    'partner_loan_in','partner_loan_out','profit_distribution',
    'tax_payment','order_billing','shipment_billing',
    'shipment_cogs','shipment_freight','adjustment'
  ));
