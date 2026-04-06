-- FEAT-45: Atomic reset_evaluations_for_period Postgres function
--
-- Called by the daily Vercel cron at /api/cron/reset-evaluations.
-- Two reset paths:
--   1. Paid subscriptions: current_period_end has passed, not yet reset this period
--   2. Free tier: calendar month (UTC) has rolled over since last reset
--
-- Returns (paid_reset_count, free_reset_count) for structured logging.
-- Idempotent: re-running within the same period/month produces zero counts.
--
-- Lives in public schema (not private) because supabaseAdmin().rpc() routes
-- through PostgREST which only exposes public + graphql_public schemas.
-- EXECUTE restricted to service_role only — same pattern as ingest_test_run.

create or replace function public.reset_evaluations_for_period()
returns table (
  paid_reset_count int,
  free_reset_count int
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_paid_count int;
  v_free_count int;
begin
  -- Path 1: Paid subscriptions whose billing period has rolled over.
  -- Guard: only active subs with usage > 0, period expired, and not already
  -- reset in the current period (last_evaluations_reset_at < current_period_start
  -- means the most recent reset predates this billing cycle).
  update public.subscriptions
  set    evaluations_used = 0,
         last_evaluations_reset_at = now()
  where  status = 'active'
    and  plan != 'free'
    and  evaluations_used > 0
    and  current_period_end is not null
    and  current_period_end < now()
    and  (last_evaluations_reset_at is null
          or last_evaluations_reset_at < current_period_start);

  get diagnostics v_paid_count = row_count;

  -- Path 2: Free tier subscriptions — calendar month (UTC) boundary.
  -- Reset if last_evaluations_reset_at is NULL (never reset) or in a
  -- previous calendar month.
  update public.subscriptions
  set    evaluations_used = 0,
         last_evaluations_reset_at = now()
  where  status = 'active'
    and  plan = 'free'
    and  evaluations_used > 0
    and  (last_evaluations_reset_at is null
          or date_trunc('month', last_evaluations_reset_at)
             < date_trunc('month', now()));

  get diagnostics v_free_count = row_count;

  return query select v_paid_count, v_free_count;
end;
$$;

-- Access control: restrict to service_role only
revoke execute on function public.reset_evaluations_for_period() from public;
revoke execute on function public.reset_evaluations_for_period() from anon;
revoke execute on function public.reset_evaluations_for_period() from authenticated;
grant execute on function public.reset_evaluations_for_period() to service_role;

comment on function public.reset_evaluations_for_period() is
  'Resets evaluations_used to 0 for qualifying subscriptions. '
  'Paid: period rolled over and not yet reset. Free: calendar month boundary (UTC). '
  'Returns (paid_reset_count, free_reset_count). '
  'Called by /api/cron/reset-evaluations via service_role admin client (.rpc). '
  'EXECUTE restricted to service_role only.';
