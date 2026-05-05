-- Phase 1 audit log: DB-enforced, append-only change history for
-- financial-impact tables. Captures every insert/update/delete so a
-- mis-edited transaction, accrual, or installment can be reconstructed
-- after the fact.
--
-- Phase 1 is capture-and-store only — no UI to read it (Phase 2). Master
-- data tables (contacts, products, partners, accounts, custody_locations,
-- app_settings, expense_types, real_estate_deals, partner_loans,
-- recurring_payments) are intentionally deferred. See decisions.md entry
-- 2026-05-05.
--
-- Apply with `supabase db push`.

-- 1. Append-only audit table.
create table public.audit_log (
  id          bigint generated always as identity primary key,
  table_name  text        not null,
  row_id      text        not null,        -- stringified PK; composite keys joined with ':'
  action      text        not null check (action in ('insert','update','delete')),
  old_data    jsonb,                       -- null on insert
  new_data    jsonb,                       -- null on delete
  changed_by  uuid,                        -- auth.uid(); null in AUTH_DISABLED dev
  changed_at  timestamptz not null default now()
);

create index audit_log_row_idx
  on public.audit_log (table_name, row_id, changed_at desc);
create index audit_log_changed_at_idx
  on public.audit_log (changed_at desc);

-- 2. RLS posture matches the rest of the codebase (disabled). Immutability
--    is enforced by REVOKE: the authenticated/anon roles cannot UPDATE or
--    DELETE audit rows. INSERT stays granted because the trigger function
--    runs as SECURITY DEFINER but we still want bare INSERT to succeed
--    even if a future code path bypasses the trigger. Service role retains
--    full access — the intended escape hatch for any future correction.
alter table public.audit_log disable row level security;
revoke update, delete on public.audit_log from authenticated, anon;

-- 3. Generic trigger function. Reads PK column name(s) from TG_ARGV
--    (defaults to ['id']), so the same function handles both id-keyed
--    tables and the one composite-key table (monthly_fx_overrides).
--
--    No-op skip: an UPDATE whose only differences are in audit-stamp
--    columns (edited_by, edited_time, created_by, created_time) is
--    treated as a non-change and not logged. This collapses the
--    transactions-rewrite flooder triggered by refreshShipmentAccruals
--    in src/features/shipments/billing.ts.
--
--    Soft-fail: if the audit insert errors for any reason, raise a
--    WARNING but allow the source write to commit. Audit completeness
--    is a soft goal vs. user-facing reliability.
create or replace function public.log_audit() returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_old      jsonb;
  v_new      jsonb;
  v_record   jsonb;
  v_row_id   text;
  v_pk_cols  text[];
  v_parts    text[];
  v_col      text;
  v_action   text;
begin
  if tg_nargs > 0 then
    v_pk_cols := tg_argv;
  else
    v_pk_cols := array['id'];
  end if;

  if tg_op = 'INSERT' then
    v_old := null;
    v_new := to_jsonb(new);
    v_record := v_new;
    v_action := 'insert';
  elsif tg_op = 'DELETE' then
    v_old := to_jsonb(old);
    v_new := null;
    v_record := v_old;
    v_action := 'delete';
  else
    v_old := to_jsonb(old);
    v_new := to_jsonb(new);
    v_record := v_new;
    v_action := 'update';
    if (v_old - 'edited_by' - 'edited_time' - 'created_by' - 'created_time')
       = (v_new - 'edited_by' - 'edited_time' - 'created_by' - 'created_time') then
      return null;
    end if;
  end if;

  v_parts := array[]::text[];
  foreach v_col in array v_pk_cols loop
    v_parts := v_parts || coalesce(v_record ->> v_col, '');
  end loop;
  v_row_id := array_to_string(v_parts, ':');

  begin
    insert into public.audit_log (table_name, row_id, action, old_data, new_data, changed_by)
    values (tg_table_name, v_row_id, v_action, v_old, v_new, auth.uid());
  exception when others then
    raise warning 'audit_log insert failed for %.%: %', tg_table_name, v_row_id, sqlerrm;
  end;

  return null;
end;
$$;

-- 4. Attach the trigger to financial-impact tables. Nine use the default
--    `id` PK; monthly_fx_overrides uses a composite (period, currency_code).
drop trigger if exists audit_transactions on public.transactions;
create trigger audit_transactions
  after insert or update or delete on public.transactions
  for each row execute function public.log_audit();

drop trigger if exists audit_treasury_movements on public.treasury_movements;
create trigger audit_treasury_movements
  after insert or update or delete on public.treasury_movements
  for each row execute function public.log_audit();

drop trigger if exists audit_orders on public.orders;
create trigger audit_orders
  after insert or update or delete on public.orders
  for each row execute function public.log_audit();

drop trigger if exists audit_order_details on public.order_details;
create trigger audit_order_details
  after insert or update or delete on public.order_details
  for each row execute function public.log_audit();

drop trigger if exists audit_shipments on public.shipments;
create trigger audit_shipments
  after insert or update or delete on public.shipments
  for each row execute function public.log_audit();

drop trigger if exists audit_loan_installments on public.loan_installments;
create trigger audit_loan_installments
  after insert or update or delete on public.loan_installments
  for each row execute function public.log_audit();

drop trigger if exists audit_psd_events on public.psd_events;
create trigger audit_psd_events
  after insert or update or delete on public.psd_events
  for each row execute function public.log_audit();

drop trigger if exists audit_real_estate_installments on public.real_estate_installments;
create trigger audit_real_estate_installments
  after insert or update or delete on public.real_estate_installments
  for each row execute function public.log_audit();

drop trigger if exists audit_recurring_payment_occurrences on public.recurring_payment_occurrences;
create trigger audit_recurring_payment_occurrences
  after insert or update or delete on public.recurring_payment_occurrences
  for each row execute function public.log_audit();

drop trigger if exists audit_monthly_fx_overrides on public.monthly_fx_overrides;
create trigger audit_monthly_fx_overrides
  after insert or update or delete on public.monthly_fx_overrides
  for each row execute function public.log_audit('period','currency_code');
