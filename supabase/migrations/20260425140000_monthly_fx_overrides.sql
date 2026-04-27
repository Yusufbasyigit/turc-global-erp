-- Monthly FX rate overrides for the Profit & Loss module.
--
-- Each row pins a USD-conversion rate for one (period, currency) pair so the
-- monthly P&L stays auditable across rate fluctuations. When no override is
-- present, the P&L falls back to the latest fx_snapshots reading inside the
-- period — the override is purely an optional manual pin.
--
-- `rate_to_usd` matches the convention used by fx_snapshots: USD per unit of
-- the named currency (e.g. for TRY, ~0.025). The UI renders the inverse for
-- legibility ("1 USD = 39.75 TRY").

create table public.monthly_fx_overrides (
  period text not null,
  currency_code text not null,
  rate_to_usd numeric not null check (rate_to_usd > 0),
  note text,
  set_at timestamptz not null default now(),
  set_by uuid references auth.users(id),
  primary key (period, currency_code),
  constraint monthly_fx_overrides_period_format
    check (period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$')
);

-- Match dev-mode policy used elsewhere in the schema. Production auth pass
-- will re-enable RLS module-by-module.
alter table public.monthly_fx_overrides disable row level security;
