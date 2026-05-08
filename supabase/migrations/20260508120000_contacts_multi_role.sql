-- Multi-role contacts ("Business Partner" pattern).
--
-- A single contact can now hold any combination of customer / supplier /
-- logistics / real_estate / other roles. The previous single `type` column
-- forced duplicate records when a company played more than one role
-- (e.g. both a customer and a supplier). This migration adds five boolean
-- flag columns, backfills them 1:1 from `type`, and requires at least one
-- role be set. The legacy `type` column is left in place during this PR;
-- a follow-up migration will drop it once verified.

-- 1. Add role flag columns (default false so existing rows are valid).
alter table public.contacts
  add column is_customer    boolean not null default false,
  add column is_supplier    boolean not null default false,
  add column is_logistics   boolean not null default false,
  add column is_real_estate boolean not null default false,
  add column is_other       boolean not null default false;

-- 2. Backfill from existing single `type`. NULL or unknown values fall
--    back to is_other = true so the new check constraint is satisfied
--    for every row.
update public.contacts set is_customer    = true where type = 'customer';
update public.contacts set is_supplier    = true where type = 'supplier';
update public.contacts set is_logistics   = true where type = 'logistics';
update public.contacts set is_real_estate = true where type = 'real_estate';
update public.contacts
  set is_other = true
  where type = 'other'
     or type is null
     or type not in ('customer', 'supplier', 'logistics', 'real_estate', 'other');

-- 3. Require at least one role on every contact going forward.
alter table public.contacts
  add constraint contacts_at_least_one_role
  check (is_customer or is_supplier or is_logistics or is_real_estate or is_other);

-- 4. Partial indexes for the role-filtered picker queries.
create index contacts_is_customer_idx
  on public.contacts (id)
  where is_customer and deleted_at is null;

create index contacts_is_supplier_idx
  on public.contacts (id)
  where is_supplier and deleted_at is null;

create index contacts_is_logistics_idx
  on public.contacts (id)
  where is_logistics and deleted_at is null;

create index contacts_is_real_estate_idx
  on public.contacts (id)
  where is_real_estate and deleted_at is null;
