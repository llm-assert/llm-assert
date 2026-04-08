-- Missing REVOKE EXECUTE FROM anon
create or replace function public.get_stats(p_id uuid)
returns table (total bigint)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query select count(*)::bigint from public.evaluations;
end;
$$;

revoke execute on function public.get_stats(uuid) from public;
grant execute on function public.get_stats(uuid) to authenticated;
