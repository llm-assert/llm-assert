-- FEAT-59: Atomic increment_evaluations Postgres function
-- Row-level locking + quota enforcement for concurrent ingest batches.
--
-- Caller contract:
--   Called by service_role admin client (bypasses RLS) from:
--     1. private.ingest_test_run() (FEAT-78) — production path
--     2. Direct SQL in tests — verification path
--   NOT callable via PostgREST API (private schema is not exposed).

-- 1. Create private schema for internal functions
create schema if not exists private;

-- 2. Backfill any NULL evaluation_limit values before adding NOT NULL constraint
update public.subscriptions
set evaluation_limit = 100
where evaluation_limit is null;

-- 3. Add NOT NULL constraint on evaluation_limit
-- Prevents silent WHERE clause failures: evaluations_used + p_count <= NULL → NULL → false
alter table public.subscriptions
  alter column evaluation_limit set not null;

-- 4. Add non-negative CHECK constraint on evaluation_limit
alter table public.subscriptions
  add constraint evaluation_limit_nonnegative
  check (evaluation_limit >= 0);

-- 5. Create the atomic increment function
create or replace function private.increment_evaluations(
  p_user_id uuid,
  p_count   int
)
returns table (
  status           text,
  new_used         int,
  evaluation_limit int
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_used  int;
  v_limit int;
begin
  -- Input validation: count must be positive
  if p_count <= 0 then
    raise exception 'p_count must be positive, got %', p_count;
  end if;

  -- Atomic increment: single UPDATE holds row lock for minimum duration.
  -- The WHERE clause ensures we only increment if within quota.
  update public.subscriptions
  set    evaluations_used = evaluations_used + p_count
  where  user_id = p_user_id
    and  status = 'active'
    and  evaluations_used + p_count <= evaluation_limit
  returning evaluations_used, evaluation_limit
  into v_used, v_limit;

  if found then
    -- Success: counter incremented within quota
    return query select 'ok'::text, v_used, v_limit;
    return;
  end if;

  -- UPDATE matched zero rows — determine why
  select s.evaluations_used, s.evaluation_limit
  into v_used, v_limit
  from public.subscriptions s
  where s.user_id = p_user_id
    and s.status = 'active';

  if found then
    -- Active subscription exists but quota would be exceeded
    return query select 'quota_exceeded'::text, v_used, v_limit;
    return;
  end if;

  -- No active subscription found
  raise exception 'No active subscription for user %', p_user_id
    using errcode = 'P0002';  -- no_data_found
end;
$$;

-- 6. Access control: restrict to service_role only
-- postgres role retains EXECUTE via ownership (created the function).
-- Explicitly revoke from public, anon, and authenticated per Supabase security best practice.
revoke execute on function private.increment_evaluations(uuid, int) from public;
revoke execute on function private.increment_evaluations(uuid, int) from anon;
revoke execute on function private.increment_evaluations(uuid, int) from authenticated;
grant execute on function private.increment_evaluations(uuid, int) to service_role;

comment on function private.increment_evaluations(uuid, int) is
  'Atomically increments evaluations_used with quota check. Returns (status, new_used, evaluation_limit). '
  'Called by private.ingest_test_run() (FEAT-78) or service_role admin client. '
  'NOT exposed via PostgREST — lives in private schema.';
