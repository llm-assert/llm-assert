-- FEAT-146: Add cancel_at_period_end column + update RPC to persist it
-- Records intermediate cancellation state so the dashboard can show
-- "Canceling — Cancels on [date]" instead of misleading "Active".

-- ---------------------------------------------------------------------------
-- 1. Add cancel_at_period_end column to subscriptions
-- ---------------------------------------------------------------------------

alter table public.subscriptions
  add column if not exists cancel_at_period_end boolean not null default false;

-- ---------------------------------------------------------------------------
-- 2. Update record_plan_transition RPC to accept and persist the new field
-- ---------------------------------------------------------------------------
-- New parameter: p_cancel_at_period_end boolean DEFAULT NULL
-- - Persisted in subscriptions upsert ON CONFLICT clause (CASE preserves
--   existing value when NULL is passed, updates when explicitly provided)
-- - Cancellation state is also captured in the p_metadata jsonb by the
--   webhook handler for audit trail context in plan_transitions rows
-- Existing callers (checkout, deleted, payment events) continue working
-- without modification because the parameter defaults to NULL (preserve).

create or replace function public.record_plan_transition(
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
  p_cancel_at_period_end boolean default null
)
returns void
language plpgsql
security definer
set search_path = ''
set statement_timeout = '5s'
as $$
begin
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
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Update permissions for the new function signature
-- ---------------------------------------------------------------------------

revoke execute on function public.record_plan_transition(
  uuid, text, text, text, text, text, text, jsonb,
  text, text, text, text, timestamptz, timestamptz, int, int, int, timestamptz, boolean
) from public;
revoke execute on function public.record_plan_transition(
  uuid, text, text, text, text, text, text, jsonb,
  text, text, text, text, timestamptz, timestamptz, int, int, int, timestamptz, boolean
) from anon;
revoke execute on function public.record_plan_transition(
  uuid, text, text, text, text, text, text, jsonb,
  text, text, text, text, timestamptz, timestamptz, int, int, int, timestamptz, boolean
) from authenticated;
grant execute on function public.record_plan_transition(
  uuid, text, text, text, text, text, text, jsonb,
  text, text, text, text, timestamptz, timestamptz, int, int, int, timestamptz, boolean
) to service_role;
