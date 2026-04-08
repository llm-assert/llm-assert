-- Bare auth.uid() without (select ...) wrapper
create or replace function public.get_stats(p_id uuid)
returns table (total bigint)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists(
    select 1 from public.projects
    where id = p_id and user_id = auth.uid()
  ) then
    return;
  end if;

  return query select count(*)::bigint from public.evaluations;
end;
$$;

revoke execute on function public.get_stats(uuid) from public;
revoke execute on function public.get_stats(uuid) from anon;
grant execute on function public.get_stats(uuid) to authenticated;
