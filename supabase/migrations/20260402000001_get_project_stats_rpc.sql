-- FEAT-21: Project overview stats aggregation
-- Returns aggregate evaluation statistics for a single project.
-- Uses SECURITY DEFINER with explicit ownership check (defense-in-depth).
-- Called from the project overview page via the SSR client (.rpc).
--
-- Returns a single row of zeros when the project exists but has no evaluations.
-- Returns zero rows when the project does not exist or is not owned by the caller.

-- rpc-lint-disable: R5
create or replace function public.get_project_stats(
  p_project_id uuid
)
returns table (
  total_evaluations bigint,
  passed           bigint,
  failed           bigint,
  inconclusive     bigint,
  avg_score        numeric(5,4),
  pass_rate        numeric(5,4),
  fail_rate        numeric(5,4)
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  -- Verify the project exists and belongs to the caller
  if not exists(
    select 1 from public.projects
    where id = p_project_id and user_id = auth.uid()
  ) then
    -- Return zero rows for non-existent or unowned projects
    return;
  end if;

  -- Return aggregated stats (always returns exactly one row)
  return query
    select
      coalesce(count(*), 0)::bigint                               as total_evaluations,
      coalesce(count(*) filter (where ev.result = 'pass'), 0)::bigint  as passed,
      coalesce(count(*) filter (where ev.result = 'fail'), 0)::bigint  as failed,
      coalesce(count(*) filter (where ev.result = 'inconclusive'), 0)::bigint as inconclusive,
      avg(ev.score)::numeric(5,4)                                 as avg_score,
      case
        when count(*) = 0 then 0::numeric(5,4)
        else (count(*) filter (where ev.result = 'pass')::numeric
              / count(*))::numeric(5,4)
      end                                                         as pass_rate,
      case
        when count(*) = 0 then 0::numeric(5,4)
        else (count(*) filter (where ev.result = 'fail')::numeric
              / count(*))::numeric(5,4)
      end                                                         as fail_rate
    from public.evaluations ev
    join public.test_runs tr on ev.test_run_id = tr.id
    where tr.project_id = p_project_id;
end;
$$;

-- Access control: restrict to authenticated users only.
revoke execute on function public.get_project_stats(uuid) from public;
revoke execute on function public.get_project_stats(uuid) from anon;
grant  execute on function public.get_project_stats(uuid) to authenticated;

comment on function public.get_project_stats(uuid)
 is
  'Returns aggregate evaluation statistics (total, passed, failed, '
  'inconclusive, avg_score, pass_rate, fail_rate) for a project. '
  'Validates ownership via auth.uid(). Returns zeros for projects with '
  'no evaluations, empty result set for unowned projects.';
