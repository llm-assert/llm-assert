-- Private schema function — R1/R3/R4 should NOT fire even without
-- SECURITY DEFINER or REVOKE/GRANT (private schema is exempt).
-- R2 (search_path) still applies to all schemas.
create schema if not exists private;

create or replace function private.increment_evaluations(
  p_user_id uuid,
  p_count   int
)
returns table (status text, new_used int)
language plpgsql
set search_path = ''
as $$
begin
  return query select 'ok'::text, 0;
end;
$$;
