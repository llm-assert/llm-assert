-- FEAT-79: Counter reconciliation query for drift detection.
-- Read-only diagnostic function comparing denormalized counters against
-- live COUNT(*) aggregates from the evaluations table.
--
-- Two reconciliation checks:
--   1. Run counter drift: test_runs summary columns vs actual evaluations
--   2. Quota counter drift: subscriptions.evaluations_used vs period-scoped COUNT
--
-- Returns only rows where a mismatch exists. Empty result = no drift.
-- Called from /api/cron/reconcile via service_role admin client (.rpc).

-- 1. Composite index for period-scoped user evaluation counts
create index if not exists idx_evaluations_user_created
  on public.evaluations (user_id, created_at desc);

-- 2. Reconciliation function
create or replace function public.reconcile_counters()
returns table (
  kind          text,
  entity_id     uuid,
  stored_value  int,
  actual_value  int,
  delta         int
)
language plpgsql
security definer
set search_path = ''
set statement_timeout = '30s'
as $$
begin
  -- Note: For phantom drift prevention, the caller should invoke this function
  -- within a REPEATABLE READ transaction. When called via Supabase .rpc(),
  -- each call runs in its own transaction with READ COMMITTED by default.
  -- The daily cron is tolerant of transient phantom drift (self-corrects on
  -- the next run), so READ COMMITTED is acceptable for the cron use case.

  -- Part 1: Run counter drift (last 90 days only)
  -- Compare test_runs.total_evaluations against COUNT(*) from evaluations.
  -- Only report the total_evaluations mismatch (if total is wrong, the
  -- breakdown counters are also suspect).
  return query
    select
      'run_counter'::text        as kind,
      tr.id                      as entity_id,
      tr.total_evaluations       as stored_value,
      actual.total::int          as actual_value,
      -- Report the largest absolute delta across all four columns so the
      -- caller always sees the most significant drift, even when total matches
      -- but a breakdown column (passed/failed/inconclusive) drifts.
      greatest(
        abs(actual.total - tr.total_evaluations),
        abs(actual.passed - tr.passed),
        abs(actual.failed - tr.failed),
        abs(actual.inconclusive - tr.inconclusive)
      )::int                     as delta
    from public.test_runs tr
    cross join lateral (
      select
        count(*)                                            as total,
        count(*) filter (where ev.result = 'pass')          as passed,
        count(*) filter (where ev.result = 'fail')          as failed,
        count(*) filter (where ev.result = 'inconclusive')  as inconclusive
      from public.evaluations ev
      where ev.test_run_id = tr.id
    ) actual
    where tr.created_at > now() - interval '90 days'
      and (
        tr.total_evaluations != actual.total
        or tr.passed         != actual.passed
        or tr.failed         != actual.failed
        or tr.inconclusive   != actual.inconclusive
      );

  -- Part 2: Quota counter drift (active subscriptions only)
  -- Compare subscriptions.evaluations_used against COUNT(evaluations)
  -- created since last_evaluations_reset_at (or month boundary for free tier).
  -- Skip recently-reset subscriptions (10-minute grace period).
  return query
    select
      'quota'::text              as kind,
      s.user_id                  as entity_id,
      s.evaluations_used         as stored_value,
      actual.period_count::int   as actual_value,
      (actual.period_count - s.evaluations_used)::int as delta
    from public.subscriptions s
    cross join lateral (
      select count(*) as period_count
      from public.evaluations ev
      where ev.user_id = s.user_id
        and ev.created_at >= coalesce(
          s.last_evaluations_reset_at,
          date_trunc('month', now())
        )
    ) actual
    where s.status = 'active'
      -- Grace period: skip recently-reset subscriptions to avoid
      -- false positives from reset cron / invoice.paid timing
      and (
        s.last_evaluations_reset_at is null
        or s.last_evaluations_reset_at <= now() - interval '10 minutes'
      )
      and s.evaluations_used != actual.period_count;
end;
$$;

-- 3. Access control: restrict to service_role only
revoke execute on function public.reconcile_counters() from public;
revoke execute on function public.reconcile_counters() from anon;
revoke execute on function public.reconcile_counters() from authenticated;
grant execute on function public.reconcile_counters() to service_role;

comment on function public.reconcile_counters() is
  'Read-only diagnostic: compares denormalized counters against live '
  'COUNT(*) aggregates from evaluations. Returns drift rows for both '
  'test_runs summary counters (90-day window) and subscriptions quota '
  'counters (period-scoped). Runs under READ COMMITTED (default), 30s '
  'statement timeout. Tolerates transient phantom drift from concurrent '
  'ingest. Called from /api/cron/reconcile via service_role admin client '
  '(.rpc). EXECUTE restricted to service_role only.';
