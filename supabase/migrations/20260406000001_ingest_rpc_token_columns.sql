-- FEAT-68: Update ingest_test_run RPC to accept and store judge token counts.
-- Backward compatible — old reporters that omit token fields will insert NULL.

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

  -- 1. Quota check
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

  -- 2. Upsert test_run (idempotent for multi-batch)
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

  -- 3. Insert evaluations — includes threshold_source and token columns
  with inserted as (
    insert into public.evaluations (
      id, test_run_id, user_id,
      assertion_type, test_name, test_file,
      input_text, context_text, expected_value,
      result, score, reasoning,
      judge_model, judge_latency_ms, judge_cost_usd,
      fallback_used, threshold, threshold_source,
      judge_input_tokens, judge_output_tokens
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
      e.threshold,
      e.threshold_source,
      e.judge_input_tokens,
      e.judge_output_tokens
    from jsonb_to_recordset(p_evaluations) as e(
      assertion_type      text,
      test_name           text,
      test_file           text,
      input_text          text,
      context_text        text,
      expected_value      text,
      result              text,
      score               numeric(5,4),
      reasoning           text,
      judge_model         text,
      judge_latency_ms    int,
      judge_cost_usd      numeric(10,6),
      fallback_used       boolean,
      threshold           numeric(5,4),
      threshold_source    text,
      judge_input_tokens  int,
      judge_output_tokens int
    )
    returning id
  )
  select count(*) into v_inserted from inserted;

  -- 4. Recompute counters
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

  -- 5. Return success
  return query select
    'ok'::text,
    p_run_id,
    v_inserted,
    v_quota.new_used,
    v_quota.eval_limit;
end;
$$;

-- Maintain service_role-only access
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
  'evaluations insert + counter recomputation. Includes threshold_source '
  'and judge_input_tokens/judge_output_tokens for cost tracking. '
  'Called from POST /api/ingest via service_role admin client (.rpc). '
  'EXECUTE restricted to service_role only.';
