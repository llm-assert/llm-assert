-- FEAT-37: Assertion type breakdown aggregation

-- Supporting index for assertion type GROUP BY performance.
create index if not exists idx_evaluations_assertion_type
  on public.evaluations (assertion_type);

-- RPC function
-- Returns evaluation counts grouped by assertion type for a single project.
-- Uses SECURITY DEFINER with explicit ownership check (defense-in-depth).
-- Called from the project overview page via the SSR client (.rpc).
--
-- Returns zero rows when the project does not exist, is not owned by the caller,
-- or has no evaluations within the time window.

create or replace function public.get_assertion_type_breakdown(
  p_project_id uuid,
  p_days       int default 30
)
returns table (
  assertion_type text,
  total          bigint,
  passed         bigint,
  failed         bigint,
  inconclusive   bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
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

  return query
    select
      ev.assertion_type,
      count(*)::bigint                                           as total,
      count(*) filter (where ev.result = 'pass')::bigint         as passed,
      count(*) filter (where ev.result = 'fail')::bigint         as failed,
      count(*) filter (where ev.result = 'inconclusive')::bigint as inconclusive
    from public.evaluations ev
    join public.test_runs tr on ev.test_run_id = tr.id
    where tr.project_id = p_project_id
      and tr.started_at >= now() - (p_days || ' days')::interval
    group by ev.assertion_type
    order by count(*) desc;
end;
$$;

-- Access control: restrict to authenticated users only.
revoke execute on function public.get_assertion_type_breakdown(uuid, int) from public;
revoke execute on function public.get_assertion_type_breakdown(uuid, int) from anon;
grant  execute on function public.get_assertion_type_breakdown(uuid, int) to authenticated;

comment on function public.get_assertion_type_breakdown(uuid, int)
 is
  'Returns evaluation counts grouped by assertion type (total, passed, failed, '
  'inconclusive) for a project within a time window. Validates ownership via '
  'auth.uid(). Returns empty result set for unowned projects.';
