-- Match dev-mode policy used on the other treasury-side tables
-- (fx_snapshots, price_snapshots, rate_refresh_runs): RLS off until
-- production auth lands. Without this, the anon-key client can't read
-- the registry to populate the crypto Combobox.
alter table public.ticker_registry disable row level security;
