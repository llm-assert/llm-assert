-- Valid: service_role RPC with all security patterns
create or replace function public.ingest_test_run(
  p_user_id uuid,
  p_run_id  uuid
)
returns table (status text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query select 'ok'::text;
end;
$$;

revoke execute on function public.ingest_test_run(uuid, uuid) from public;
revoke execute on function public.ingest_test_run(uuid, uuid) from anon;
revoke execute on function public.ingest_test_run(uuid, uuid) from authenticated;
grant execute on function public.ingest_test_run(uuid, uuid) to service_role;
