-- Valid: authenticated RPC with all security patterns
create or replace function public.get_project_stats(
  p_project_id uuid
)
returns table (total bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  -- Ownership check: uses auth.uid() wrapped in scalar subselect
  if not exists(
    select 1 from public.projects
    where id = p_project_id and user_id = (select auth.uid())
  ) then
    return;
  end if;

  return query select count(*)::bigint from public.evaluations;
end;
$$;

revoke execute on function public.get_project_stats(uuid) from public;
revoke execute on function public.get_project_stats(uuid) from anon;
grant execute on function public.get_project_stats(uuid) to authenticated;
