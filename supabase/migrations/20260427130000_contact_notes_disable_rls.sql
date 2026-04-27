-- Match dev-mode policy used elsewhere in the schema (contacts, products,
-- accounts, treasury_movements): RLS off until production auth lands.
alter table public.contact_notes disable row level security;
