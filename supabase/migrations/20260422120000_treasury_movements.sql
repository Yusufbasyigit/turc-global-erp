-- Treasury foundation: quantity-change movements on holdings.
-- See treasury.md (core principle: quantity is the source of truth) and the
-- 2026-04-22 decisions.md block explaining why this lives in its own table
-- rather than on `transactions`.

create table public.treasury_movements (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id),
  movement_date date not null,
  kind text not null check (kind in (
    'opening', 'deposit', 'withdraw', 'transfer', 'trade', 'adjustment'
  )),
  quantity numeric not null,
  group_id uuid null,
  notes text null,
  ortak_movement_type text null check (ortak_movement_type in (
    'partner_loan_in', 'partner_loan_out', 'profit_share'
  )),
  created_by text null,
  created_time timestamptz not null default now(),
  edited_by text null,
  edited_time timestamptz null
);

create index treasury_movements_account_id_idx
  on public.treasury_movements (account_id);
create index treasury_movements_group_id_idx
  on public.treasury_movements (group_id);
create index treasury_movements_movement_date_idx
  on public.treasury_movements (movement_date);

alter table public.custody_locations
  add column requires_movement_type boolean not null default false;

update public.custody_locations
  set requires_movement_type = true
  where name = 'Ortak';
