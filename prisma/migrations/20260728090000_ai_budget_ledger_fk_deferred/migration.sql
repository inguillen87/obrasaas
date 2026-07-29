-- PostgreSQL does not guarantee sibling cascade order when deleting an
-- Organization. Keep the ledger FK NO ACTION, but defer its validation until
-- transaction end so reservation and ledger cascades can complete as a unit.
ALTER TABLE "AiDispatchBudgetReservation"
  ALTER CONSTRAINT "AiDispatchBudgetReservation_daily_ledger_fkey"
  DEFERRABLE INITIALLY DEFERRED;
