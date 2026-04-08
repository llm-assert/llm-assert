-- FEAT-130: Downgrade path — reset canceled subscriptions to free tier
--
-- When a paid subscription is canceled in Stripe, users were left in a
-- "canceled" state with no active plan. The webhook handler now resets them
-- to free tier (plan='free', evaluation_limit=100, evaluations_used=0,
-- status='active'). This migration backfills existing canceled users.
--
-- The UPDATE is idempotent: re-running produces no changes since all
-- matching rows will already have status='active' after the first run.

do $$
declare
  affected_count int;
begin
  select count(*) into affected_count
  from public.subscriptions
  where status = 'canceled';

  raise notice 'FEAT-130 backfill: % canceled subscription(s) to reset to free tier', affected_count;
end $$;

update public.subscriptions
set
  plan = 'free',
  evaluation_limit = 100,
  evaluations_used = 0,
  status = 'active',
  last_evaluations_reset_at = now(),
  updated_at = now()
where status = 'canceled';
