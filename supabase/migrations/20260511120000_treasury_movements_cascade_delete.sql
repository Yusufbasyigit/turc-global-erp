-- Convert treasury_movements.source_transaction_id FK from
-- ON DELETE SET NULL to ON DELETE CASCADE.
--
-- The original transactions foundation migration (20260423120000) created
-- the link with `on delete set null`. The intent at the time was to keep
-- the movement row around if a transaction was hard-deleted. In practice
-- that produces orphaned movement rows whose `quantity` still contributes
-- to every `SUM(quantity)` balance calculation across the treasury — i.e.
-- the deletion silently corrupts account balances.
--
-- Every delete path in the codebase already deletes the linked
-- treasury_movement first to avoid this (see deletePsdEvent, deleteLoan,
-- the rollback inside recordRepayment, recurring-payments undoOccurrence,
-- and the rollback inside createTransaction). Promoting the FK to CASCADE
-- makes that discipline the database's responsibility instead of the
-- caller's, so any future path that forgets to clear the movement first
-- still produces a consistent ledger.
--
-- No app code depends on the SET NULL behaviour. There are no callers
-- that intentionally want the movement to survive after the transaction
-- is gone — every existing site explicitly deletes the movement first
-- (and a couple have inline comments noting they have to because the FK
-- was SET NULL). Those callers continue to work unchanged: deleting the
-- movement first is a no-op if it's already gone, and the CASCADE catches
-- any path that didn't bother.

alter table public.treasury_movements
  drop constraint treasury_movements_source_transaction_id_fkey;

alter table public.treasury_movements
  add constraint treasury_movements_source_transaction_id_fkey
  foreign key (source_transaction_id)
  references public.transactions(id)
  on delete cascade;
