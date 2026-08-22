-- PROJ-17: applyPendingChange (PROJ-9) currently clears pending_effective_date
-- when a cancellation is applied, losing the only date that recorded when it
-- became effective. This column preserves it for the churn metric.
alter table public.subscriptions add column cancelled_at date;
