-- KDV period tagging on tax_payment rows
-- Adds the single piece of metadata that links a filed tax payment
-- to the VAT period it covers. Status ('filed' vs 'unfiled') is derived
-- from the presence of a tax_payment row with a matching kdv_period;
-- no separate periods table.

alter table public.transactions
  add column kdv_period text null;

alter table public.transactions
  add constraint transactions_kdv_period_shape
    check (kdv_period is null or kdv_period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');

alter table public.transactions
  add constraint transactions_kdv_period_only_on_tax_payment
    check (kdv_period is null or kind = 'tax_payment');

create index transactions_kdv_period_idx
  on public.transactions (kdv_period)
  where kdv_period is not null;
