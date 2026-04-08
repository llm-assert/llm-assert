-- Valid: uses SET search_path TO '' (alternative syntax)
create or replace function public.get_version()
returns text
language plpgsql
security definer
set search_path to ''
as $$
begin
  return '1.0.0';
end;
$$;

revoke execute on function public.get_version() from public;
revoke execute on function public.get_version() from anon;
grant execute on function public.get_version() to authenticated;
