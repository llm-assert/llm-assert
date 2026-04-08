-- SEC-41: Atomic webhook processing
-- Moves stripe_webhook_events dedup INSERT inside record_plan_transition()
-- so that dedup + subscription upsert + audit insert are a single transaction.
-- If the RPC fails, the dedup row rolls back and Stripe retries succeed.
--
-- Changes from previous version (20260413000000_cancel_at_period_end.sql):
-- 1. Returns text ('ok' | 'duplicate') instead of void
-- 2. New parameter: p_event_type text DEFAULT NULL
-- 3. Dedup INSERT as first operation inside the function body
-- All existing parameters preserved (including p_cancel_at_period_end).
--
-- NOTE: Postgres does not allow CREATE OR REPLACE to change return type.
-- We must DROP the old (void) signature first, then CREATE the new (text) one.

-- Drop ALL old void-returning overloads.
-- 20260412 created 18-param version (no p_cancel_at_period_end).
-- 20260413 replaced it with 19-param version (added p_cancel_at_period_end).
-- Both must be dropped since Postgres overloads on argument count.
drop function if exists public.record_plan_transition(
  uuid, text, text, text, text, text, text, jsonb,
  text, text, text, text, timestamptz, timestamptz, int, int, int, timestamptz
);
drop function if exists public.record_plan_transition(
  uuid, text, text, text, text, text, text, jsonb,
  text, text, text, text, timestamptz, timestamptz, int, int, int, timestamptz, boolean
);

create function public.record_plan_transition(
  p_user_id uuid,
  p_old_plan text,
  p_new_plan text,
  p_old_status text,
  p_new_status text,
  p_reason text,
  p_stripe_event_id text,
  p_metadata jsonb,
  -- Subscription update fields
  p_stripe_customer_id text default null,
  p_stripe_subscription_id text default null,
  p_plan text default null,
  p_status text default null,
  p_current_period_start timestamptz default null,
  p_current_period_end timestamptz default null,
  p_evaluation_limit int default null,
  p_project_limit int default null,
  p_evaluations_used int default null,
  p_last_evaluations_reset_at timestamptz default null,
  p_cancel_at_period_end boolean default null,
  -- New: event type for dedup row
  p_event_type text default null
)
returns text
language plpgsql
security definer
set search_path = ''
set statement_timeout = '5s'
as $$
begin
  -- 0. Atomic dedup: insert event or detect duplicate
  insert into public.stripe_webhook_events (event_id, event_type)
  values (p_stripe_event_id, p_event_type)
  on conflict (event_id) do nothing;

  if not found then
    return 'duplicate';
  end if;

  -- 1. Upsert the subscription row
  insert into public.subscriptions (
    user_id,
    plan,
    status,
    stripe_customer_id,
    stripe_subscription_id,
    current_period_start,
    current_period_end,
    evaluation_limit,
    project_limit,
    evaluations_used,
    last_evaluations_reset_at,
    cancel_at_period_end
  ) values (
    p_user_id,
    coalesce(p_plan, 'free'),
    coalesce(p_status, 'active'),
    p_stripe_customer_id,
    p_stripe_subscription_id,
    p_current_period_start,
    p_current_period_end,
    coalesce(p_evaluation_limit, 100),
    coalesce(p_project_limit, 1),
    coalesce(p_evaluations_used, 0),
    p_last_evaluations_reset_at,
    coalesce(p_cancel_at_period_end, false)
  )
  on conflict (user_id) do update set
    plan = coalesce(p_plan, public.subscriptions.plan),
    status = coalesce(p_status, public.subscriptions.status),
    stripe_customer_id = coalesce(p_stripe_customer_id, public.subscriptions.stripe_customer_id),
    stripe_subscription_id = coalesce(p_stripe_subscription_id, public.subscriptions.stripe_subscription_id),
    current_period_start = case when p_current_period_start is not null then p_current_period_start else public.subscriptions.current_period_start end,
    current_period_end = case when p_reason = 'subscription_deleted' then null when p_current_period_end is not null then p_current_period_end else public.subscriptions.current_period_end end,
    evaluation_limit = coalesce(p_evaluation_limit, public.subscriptions.evaluation_limit),
    project_limit = coalesce(p_project_limit, public.subscriptions.project_limit),
    evaluations_used = coalesce(p_evaluations_used, public.subscriptions.evaluations_used),
    last_evaluations_reset_at = coalesce(p_last_evaluations_reset_at, public.subscriptions.last_evaluations_reset_at),
    cancel_at_period_end = case when p_cancel_at_period_end is not null then p_cancel_at_period_end else public.subscriptions.cancel_at_period_end end;

  -- 2. Insert audit row only if plan or status actually changed
  if p_old_plan is distinct from p_new_plan
     or p_old_status is distinct from p_new_status then
    insert into public.plan_transitions (
      user_id, old_plan, new_plan, old_status, new_status,
      reason, stripe_event_id, metadata
    ) values (
      p_user_id, p_old_plan, p_new_plan, p_old_status, p_new_status,
      p_reason, p_stripe_event_id, p_metadata
    )
    on conflict (stripe_event_id) do nothing;
  end if;

  return 'ok';
end;
$$;

-- ---------------------------------------------------------------------------
-- Update permissions for the new function signature
-- ---------------------------------------------------------------------------
-- The old void-returning function was DROPped above (Postgres requires DROP
-- to change return type). We must revoke/grant for the NEW text-returning signature.

revoke execute on function public.record_plan_transition(
  uuid, text, text, text, text, text, text, jsonb,
  text, text, text, text, timestamptz, timestamptz, int, int, int, timestamptz, boolean, text
) from public;
revoke execute on function public.record_plan_transition(
  uuid, text, text, text, text, text, text, jsonb,
  text, text, text, text, timestamptz, timestamptz, int, int, int, timestamptz, boolean, text
) from anon;
revoke execute on function public.record_plan_transition(
  uuid, text, text, text, text, text, text, jsonb,
  text, text, text, text, timestamptz, timestamptz, int, int, int, timestamptz, boolean, text
) from authenticated;
grant execute on function public.record_plan_transition(
  uuid, text, text, text, text, text, text, jsonb,
  text, text, text, text, timestamptz, timestamptz, int, int, int, timestamptz, boolean, text
) to service_role;
