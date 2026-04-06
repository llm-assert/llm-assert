-- FEAT-45: Add last_evaluations_reset_at for cron reset idempotency tracking
--
-- Tracks when each subscription's evaluations_used was last reset (by either
-- the invoice.paid webhook or the daily cron). NULL means never reset by cron
-- (or created before this column existed).

alter table public.subscriptions
  add column last_evaluations_reset_at timestamptz default null;

comment on column public.subscriptions.last_evaluations_reset_at is
  'Timestamp of last evaluations_used reset (via webhook or cron). '
  'NULL means never reset or created before FEAT-45. '
  'Used for cron idempotency: prevents double-resets within same period.';
