-- FEAT-36: Project trends time-series aggregation
-- Returns daily-bucketed evaluation stats for a single project.
-- Uses SECURITY DEFINER with explicit ownership check (defense-in-depth).
-- Called from the trends page via the SSR client (.rpc).
--
-- Zero-fills missing dates via generate_series so charts render continuous lines.
-- Returns zero rows when the project does not exist or is not owned by the caller.

-- Supporting index for time-series query performance.
-- Note: idx_test_runs_project (project_id, started_at DESC) already exists
-- and supports the WHERE project_id = X AND started_at >= Y range scan.
-- The date_trunc GROUP BY runs after the filter, so no functional index needed.
create index if not exists idx_evaluations_run_result_score
  on public.evaluations (test_run_id, result, score);

-- RPC function
create or replace function public.get_project_trends(
  p_project_id uuid,
  p_bucket     text default 'day',
  p_days       int  default 30
)
returns table (
  bucket       timestamptz,
  total        bigint,
  passed       bigint,
  failed       bigint,
  inconclusive bigint,
  avg_score    numeric(5,4)
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_start timestamptz;
begin
  -- Validate bucket parameter (whitelist to prevent injection)
  if p_bucket not in ('day', 'week') then
    raise exception 'Invalid bucket parameter: %. Must be ''day'' or ''week''.', p_bucket;
  end if;

  -- Cap days to prevent expensive full-table scans
  if p_days > 365 then
    p_days := 365;
  end if;
  if p_days < 1 then
    p_days := 1;
  end if;

  -- Verify the project exists and belongs to the caller
  if not exists(
    select 1 from public.projects
    where id = p_project_id and user_id = (select auth.uid())
  ) then
    -- Return zero rows for non-existent or unowned projects
    return;
  end if;

  v_start := date_trunc(p_bucket, now() - (p_days || ' days')::interval);

  return query
    with date_series as (
      select generate_series(
        v_start,
        date_trunc(p_bucket, now()),
        ('1 ' || p_bucket)::interval
      ) as bucket
    ),
    raw_stats as (
      select
        date_trunc(p_bucket, tr.started_at) as bucket,
        count(*)::bigint                                                    as total,
        count(*) filter (where ev.result = 'pass')::bigint                  as passed,
        count(*) filter (where ev.result = 'fail')::bigint                  as failed,
        count(*) filter (where ev.result = 'inconclusive')::bigint          as inconclusive,
        avg(ev.score)::numeric(5,4)                                         as avg_score
      from public.evaluations ev
      join public.test_runs tr on ev.test_run_id = tr.id
      where tr.project_id = p_project_id
        and tr.started_at >= v_start
      group by date_trunc(p_bucket, tr.started_at)
    )
    select
      ds.bucket,
      coalesce(rs.total, 0)::bigint        as total,
      coalesce(rs.passed, 0)::bigint       as passed,
      coalesce(rs.failed, 0)::bigint       as failed,
      coalesce(rs.inconclusive, 0)::bigint as inconclusive,
      rs.avg_score
    from date_series ds
    left join raw_stats rs on ds.bucket = rs.bucket
    order by ds.bucket;
end;
$$;

-- Access control: restrict to authenticated users only.
revoke execute on function public.get_project_trends(uuid, text, int) from public;
revoke execute on function public.get_project_trends(uuid, text, int) from anon;
grant  execute on function public.get_project_trends(uuid, text, int) to authenticated;

comment on function public.get_project_trends(uuid, text, int)
 is
  'Returns daily or weekly bucketed evaluation trends (total, passed, failed, '
  'inconclusive, avg_score) for a project. Zero-fills dates with no evaluations. '
  'Validates ownership via auth.uid(). Returns empty result set for unowned projects.';
