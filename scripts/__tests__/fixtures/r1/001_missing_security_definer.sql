-- Missing SECURITY DEFINER on public function
create or replace function public.get_stats(p_id uuid)
returns table (total bigint)
language plpgsql
set search_path = ''
as $$
begin
  return query select count(*)::bigint from public.evaluations;
end;
$$;

revoke execute on function public.get_stats(uuid) from public;
revoke execute on function public.get_stats(uuid) from anon;
grant execute on function public.get_stats(uuid) to authenticated;
