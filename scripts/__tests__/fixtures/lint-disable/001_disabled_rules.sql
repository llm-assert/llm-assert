-- rpc-lint-disable: R1, R3, R4
create or replace function public.legacy_function(p_id uuid)
returns table (total bigint)
language plpgsql
set search_path = ''
as $$
begin
  return query select count(*)::bigint from public.evaluations;
end;
$$;
