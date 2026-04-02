-- FEAT-18 + FEAT-78: Atomic ingest_test_run Postgres function
-- Wraps quota check + test_run upsert + evaluations batch insert + counter
-- recomputation in a single transaction. If any step fails the entire
-- transaction rolls back — including the quota increment.
--
-- Called exclusively by the service_role admin client from POST /api/ingest
-- via supabaseAdmin().rpc('ingest_test_run', {...}).
--
-- Lives in public schema (so PostgREST can route .rpc() calls) but EXECUTE
-- is revoked from anon/authenticated — only service_role can invoke it.
-- Internal helper private.increment_evaluations() stays in private schema
-- (called from within this function, not via PostgREST).

create or replace function public.ingest_test_run(
  p_user_id      uuid,
  p_project_id   uuid,
  p_run_id       uuid,
  p_started_at   timestamptz,
  p_finished_at  timestamptz default null,
  p_ci_provider  text        default null,
  p_ci_run_url   text        default null,
  p_branch       text        default null,
  p_commit_sha   text        default null,
  p_metadata     jsonb       default '{}',
  p_evaluations  jsonb       default '[]'
)
returns table (
  status              text,
  run_id              uuid,
  evaluations_ingested int,
  evaluations_used    int,
  evaluation_limit    int
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_eval_count int;
  v_quota      record;
  v_inserted   int;
begin
  v_eval_count := jsonb_array_length(p_evaluations);

  -- 1. Quota check — calls private.increment_evaluations which holds
  --    a row-level lock for minimum duration. On rollback the increment
  --    is also rolled back (same transaction).
  select q.status   as status,
         q.new_used as new_used,
         q.evaluation_limit as eval_limit
  into v_quota
  from private.increment_evaluations(p_user_id, v_eval_count) q;

  if v_quota.status = 'quota_exceeded' then
    return query select
      'quota_exceeded'::text,
      p_run_id,
      0,
      v_quota.new_used,
      v_quota.eval_limit;
    return;
  end if;

  -- 2. Upsert test_run — idempotent for multi-batch.
  --    First batch creates the row; subsequent batches skip via ON CONFLICT.
  insert into public.test_runs (
    id, project_id, user_id,
    started_at, finished_at,
    ci_provider, ci_run_url, branch, commit_sha,
    metadata,
    total_evaluations, passed, failed, inconclusive
  ) values (
    p_run_id, p_project_id, p_user_id,
    p_started_at, p_finished_at,
    p_ci_provider, p_ci_run_url, p_branch, p_commit_sha,
    p_metadata,
    0, 0, 0, 0
  )
  on conflict (id) do nothing;

  -- 3. Insert evaluations from JSONB array with server-generated UUIDs.
  with inserted as (
    insert into public.evaluations (
      id, test_run_id, user_id,
      assertion_type, test_name, test_file,
      input_text, context_text, expected_value,
      result, score, reasoning,
      judge_model, judge_latency_ms, judge_cost_usd,
      fallback_used, threshold
    )
    select
      gen_random_uuid(),
      p_run_id,
      p_user_id,
      e.assertion_type,
      e.test_name,
      e.test_file,
      e.input_text,
      e.context_text,
      e.expected_value,
      e.result,
      e.score,
      e.reasoning,
      e.judge_model,
      e.judge_latency_ms,
      e.judge_cost_usd,
      e.fallback_used,
      e.threshold
    from jsonb_to_recordset(p_evaluations) as e(
      assertion_type  text,
      test_name       text,
      test_file       text,
      input_text      text,
      context_text    text,
      expected_value  text,
      result          text,
      score           numeric(5,4),
      reasoning       text,
      judge_model     text,
      judge_latency_ms int,
      judge_cost_usd  numeric(10,6),
      fallback_used   boolean,
      threshold       numeric(5,4)
    )
    returning id
  )
  select count(*) into v_inserted from inserted;

  -- 4. Recompute counters from actual rows (not incremental arithmetic).
  --    This is correct even for multi-batch: each batch recomputes from all
  --    evaluations for the run, serialized by the test_runs row lock.
  update public.test_runs
  set
    total_evaluations = sub.total,
    passed            = sub.passed,
    failed            = sub.failed,
    inconclusive      = sub.inconclusive
  from (
    select
      count(*)                                          as total,
      count(*) filter (where ev.result = 'pass')        as passed,
      count(*) filter (where ev.result = 'fail')        as failed,
      count(*) filter (where ev.result = 'inconclusive') as inconclusive
    from public.evaluations ev
    where ev.test_run_id = p_run_id
  ) sub
  where public.test_runs.id = p_run_id;

  -- 5. Return success with counts
  return query select
    'ok'::text,
    p_run_id,
    v_inserted,
    v_quota.new_used,
    v_quota.eval_limit;
end;
$$;

-- Access control: restrict to service_role only.
-- Function is in public schema so PostgREST can route .rpc() calls,
-- but only service_role can execute it.
revoke execute on function public.ingest_test_run(
  uuid, uuid, uuid, timestamptz, timestamptz,
  text, text, text, text, jsonb, jsonb
) from public;
revoke execute on function public.ingest_test_run(
  uuid, uuid, uuid, timestamptz, timestamptz,
  text, text, text, text, jsonb, jsonb
) from anon;
revoke execute on function public.ingest_test_run(
  uuid, uuid, uuid, timestamptz, timestamptz,
  text, text, text, text, jsonb, jsonb
) from authenticated;
grant execute on function public.ingest_test_run(
  uuid, uuid, uuid, timestamptz, timestamptz,
  text, text, text, text, jsonb, jsonb
) to service_role;

comment on function public.ingest_test_run(
  uuid, uuid, uuid, timestamptz, timestamptz,
  text, text, text, text, jsonb, jsonb
) is
  'Atomically ingests a test run batch: quota check + test_run upsert + '
  'evaluations insert + counter recomputation. Called from POST /api/ingest '
  'via service_role admin client (.rpc). EXECUTE restricted to service_role only.';
