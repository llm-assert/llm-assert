-- SEC-43: Ghost event audit query
-- Detects orphaned stripe_webhook_events rows with no matching plan_transitions
-- entry, caused by the pre-SEC-41 atomicity gap. Read-only diagnostic function.
--
-- Ghost events can only exist between FEAT-57 (webhook idempotency table,
-- ~2026-04-03) and SEC-41 (atomic dedup, merged 2026-04-08). The cutoff
-- timestamp bounds the scan to this window.

-- ---------------------------------------------------------------------------
-- 1. Index: event_type on stripe_webhook_events
-- ---------------------------------------------------------------------------
-- Supports the WHERE event_type IN (...) filter in the ghost audit query.
-- The PK covers event_id lookups; this index covers the type-scoped scan.

create index if not exists idx_stripe_webhook_events_event_type
  on stripe_webhook_events (event_type);

-- ---------------------------------------------------------------------------
-- 2. Function: ghost_event_audit()
-- ---------------------------------------------------------------------------

create or replace function public.ghost_event_audit()
returns jsonb
language plpgsql
security definer
set search_path = ''
set statement_timeout = '5s'
as $$
declare
  v_ghost_count     int;
  v_definite_count  int;
  v_noop_count      int;
  v_event_types     jsonb;
  v_oldest          timestamptz;
  v_newest          timestamptz;
  v_sample_ids      jsonb;
begin
  -- Identify orphaned events: subscription lifecycle types processed before
  -- the SEC-41 deploy cutoff with no matching plan_transitions row.
  -- checkout.session.completed and customer.subscription.deleted ALWAYS
  -- produce a plan_transitions row → confidence = 'definite'.
  -- customer.subscription.updated may legitimately skip the INSERT when
  -- plan/status unchanged (period rotation, cancel_at_period_end toggle)
  -- → confidence = 'possible_noop'.

  select
    count(*),
    count(*) filter (where swe.event_type in (
      'checkout.session.completed',
      'customer.subscription.deleted'
    )),
    count(*) filter (where swe.event_type = 'customer.subscription.updated'),
    coalesce(jsonb_agg(distinct swe.event_type), '[]'::jsonb),
    min(swe.processed_at),
    max(swe.processed_at)
  into
    v_ghost_count,
    v_definite_count,
    v_noop_count,
    v_event_types,
    v_oldest,
    v_newest
  from public.stripe_webhook_events swe
  where swe.event_type in (
    'checkout.session.completed',
    'customer.subscription.updated',
    'customer.subscription.deleted'
  )
    and swe.processed_at < '2026-04-08T12:00:00Z'
    and not exists (
      select 1
      from public.plan_transitions pt
      where pt.stripe_event_id = swe.event_id
    );

  -- Sample up to 5 event IDs for manual cross-reference in Stripe Dashboard
  select coalesce(jsonb_agg(sub.event_id), '[]'::jsonb)
  into v_sample_ids
  from (
    select swe.event_id
    from public.stripe_webhook_events swe
    where swe.event_type in (
      'checkout.session.completed',
      'customer.subscription.updated',
      'customer.subscription.deleted'
    )
      and swe.processed_at < '2026-04-08T12:00:00Z'
      and not exists (
        select 1
        from public.plan_transitions pt
        where pt.stripe_event_id = swe.event_id
      )
    order by swe.processed_at desc
    limit 5
  ) sub;

  return jsonb_build_object(
    'ghost_count',        v_ghost_count,
    'definite_count',     v_definite_count,
    'possible_noop_count', v_noop_count,
    'event_types',        v_event_types,
    'oldest_ghost_at',    v_oldest,
    'newest_ghost_at',    v_newest,
    'sample_event_ids',   v_sample_ids
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Permissions: service_role only
-- ---------------------------------------------------------------------------
-- Matches the record_plan_transition() permission pattern from SEC-41.
-- Without these, any PostgREST caller with an anon key can invoke the
-- function and receive Stripe event IDs.

revoke execute on function public.ghost_event_audit() from public;
revoke execute on function public.ghost_event_audit() from anon;
revoke execute on function public.ghost_event_audit() from authenticated;
grant  execute on function public.ghost_event_audit() to service_role;
