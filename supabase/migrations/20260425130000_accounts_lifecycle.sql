-- Accounts lifecycle columns: is_active (deactivate, hides from pickers)
-- and deleted_at (soft-delete, hides from registry). Mirrors the partners
-- pattern from 20260423120000_transactions_foundation.sql.

alter table public.accounts
  add column if not exists is_active boolean not null default true,
  add column if not exists deleted_at timestamptz null;

-- Picker chokepoint: every account picker filters on these two together.
create index if not exists accounts_active_idx
  on public.accounts (id)
  where deleted_at is null and is_active = true;

-- Defensive dedupe: the unique index below would fail if any two existing
-- accounts share a case-insensitive name. Suffix all but the oldest in each
-- collision group with a short id fragment so the index can be created. Users
-- can rename properly afterwards.
update public.accounts
set account_name = account_name || ' (' || substring(id::text, 1, 8) || ')'
where id in (
  select id
  from (
    select
      id,
      row_number() over (
        partition by lower(account_name)
        order by created_time, id
      ) as rn
    from public.accounts
    where deleted_at is null
  ) ranked
  where rn > 1
);

-- Defense alongside the form's case-insensitive uniqueness check. Allows a
-- soft-deleted name to be reused (the partial WHERE excludes deleted rows).
create unique index if not exists accounts_unique_active_name_idx
  on public.accounts (lower(account_name))
  where deleted_at is null;
