-- Unified audit log for every FX + price snapshot refresh run, whether
-- triggered by the Treasury "Refresh rates" button or the pg_cron schedule.
-- Surfaces silent cron failures on the Treasury header ("Last refresh: ...")
-- and lets the delayed-pill detect missed weekday fires.
create table public.rate_refresh_runs (
  id uuid primary key default gen_random_uuid(),
  ran_at timestamptz not null default now(),
  triggered_by text not null check (triggered_by in ('cron', 'manual')),
  fx_outcome jsonb,
  price_outcome jsonb,
  error_message text
);

create index rate_refresh_runs_ran_at_idx
  on public.rate_refresh_runs (ran_at desc);

-- Match dev-mode policy used on fx_snapshots / price_snapshots etc.
alter table public.rate_refresh_runs disable row level security;
