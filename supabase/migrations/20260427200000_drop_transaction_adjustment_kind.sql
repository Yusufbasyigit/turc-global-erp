-- Drop the `adjustment` kind from transactions.
--
-- Adjustment was the 4th top-level slot in the transaction picker but was
-- effectively unused. Real cash corrections are expressible as money-in /
-- money-out with a note. Dropping the kind narrows the schema and the picker.
-- This does NOT touch treasury_movements.kind = 'adjustment', which is a
-- separate concept (signed quantity correction for cash/inventory counts).

ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_kind_check;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_kind_check
  CHECK (kind IN (
    'client_payment','client_refund',
    'supplier_payment','supplier_invoice',
    'expense','other_income','other_expense',
    'partner_loan_in','partner_loan_out','profit_distribution',
    'tax_payment','order_billing','shipment_billing',
    'shipment_cogs','shipment_freight'
  ));
