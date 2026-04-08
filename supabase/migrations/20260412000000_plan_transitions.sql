-- Plan transition audit table (FEAT-145)
-- Records every subscription plan or status change for chargeback defense,
-- compliance, and operational debugging.

-- ---------------------------------------------------------------------------
-- 1. Table: plan_transitions
-- ---------------------------------------------------------------------------

create table if not exists plan_transitions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  old_plan text,          -- nullable for first subscription (new user)
  new_plan text not null,
  old_status text,        -- nullable for first subscription (new user)
  new_status text not null,
  reason text not null check (
    reason in (
      'checkout_completed',
      'subscription_updated',
      'subscription_deleted',
      'payment_failed',
      'payment_recovered'
    )
  ),
  stripe_event_id text not null unique,
  metadata jsonb,         -- { evaluation_limit, project_limit, current_period_start, current_period_end }
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 2. RLS: read-only user access, service-role writes only
-- ---------------------------------------------------------------------------
-- No INSERT/UPDATE/DELETE policies exist because all writes happen via
-- service_role (webhook handler) or SECURITY DEFINER RPC. This prevents
-- authenticated users from fabricating audit rows.

alter table plan_transitions enable row level security;

create policy "Users can view own plan transitions"
  on plan_transitions for select
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- 3. Indexes
-- ---------------------------------------------------------------------------

create index idx_plan_transitions_user_id
  on plan_transitions(user_id);

create index idx_plan_transitions_created_at
  on plan_transitions(created_at desc);

-- ---------------------------------------------------------------------------
-- 4. RPC: record_plan_transition (atomic subscription UPSERT + audit INSERT)
-- ---------------------------------------------------------------------------
-- Lives in `public` schema so PostgREST can expose it to the service_role
-- client. SECURITY DEFINER runs as table owner, bypassing RLS.
-- Statement timeout guards against runaway queries.
-- All application callers (webhook handler) validate Stripe signature first.

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
  p_last_evaluations_reset_at timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = ''
set statement_timeout = '5s'
as $$
begin
  -- 1. Upsert the subscription row (INSERT if auth trigger hasn't fired yet,
  --    UPDATE if row already exists). Uses ON CONFLICT on user_id unique constraint.
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
    last_evaluations_reset_at
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
    p_last_evaluations_reset_at
  )
  on conflict (user_id) do update set
    plan = coalesce(p_plan, public.subscriptions.plan),
    status = coalesce(p_status, public.subscriptions.status),
    stripe_customer_id = coalesce(p_stripe_customer_id, public.subscriptions.stripe_customer_id),
    stripe_subscription_id = coalesce(p_stripe_subscription_id, public.subscriptions.stripe_subscription_id),
    -- Period dates: CASE preserves existing value when NULL is passed (meaning "not provided").
    -- To clear current_period_end on cancellation, pass p_reason = 'subscription_deleted'.
    current_period_start = case when p_current_period_start is not null then p_current_period_start else public.subscriptions.current_period_start end,
    current_period_end = case when p_reason = 'subscription_deleted' then null when p_current_period_end is not null then p_current_period_end else public.subscriptions.current_period_end end,
    evaluation_limit = coalesce(p_evaluation_limit, public.subscriptions.evaluation_limit),
    project_limit = coalesce(p_project_limit, public.subscriptions.project_limit),
    -- evaluations_used: explicit assignment so 0 resets work (COALESCE(0, x) = 0 is fine but null should preserve)
    evaluations_used = coalesce(p_evaluations_used, public.subscriptions.evaluations_used),
    last_evaluations_reset_at = coalesce(p_last_evaluations_reset_at, public.subscriptions.last_evaluations_reset_at);

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
-- 5. Permissions: service_role only (webhook handler)
-- ---------------------------------------------------------------------------
-- By default, Postgres grants EXECUTE to PUBLIC on all functions.
-- Revoke from public, anon, and authenticated to prevent direct invocation
-- via PostgREST. Only service_role (admin client in webhook handler) may call.

revoke execute on function public.record_plan_transition(
  uuid, text, text, text, text, text, text, jsonb,
  text, text, text, text, timestamptz, timestamptz, int, int, int, timestamptz
) from public;
revoke execute on function public.record_plan_transition(
  uuid, text, text, text, text, text, text, jsonb,
  text, text, text, text, timestamptz, timestamptz, int, int, int, timestamptz
) from anon;
revoke execute on function public.record_plan_transition(
  uuid, text, text, text, text, text, text, jsonb,
  text, text, text, text, timestamptz, timestamptz, int, int, int, timestamptz
) from authenticated;
grant execute on function public.record_plan_transition(
  uuid, text, text, text, text, text, text, jsonb,
  text, text, text, text, timestamptz, timestamptz, int, int, int, timestamptz
) to service_role;
