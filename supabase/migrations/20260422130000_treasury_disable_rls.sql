-- Match dev-mode policy used elsewhere in the schema (contacts, products,
-- accounts, treasury_movements): RLS off until production auth lands.
alter table public.custody_locations disable row level security;
alter table public.fx_snapshots disable row level security;
alter table public.price_snapshots disable row level security;
