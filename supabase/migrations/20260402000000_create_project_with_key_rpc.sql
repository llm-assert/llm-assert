-- FEAT-20: Atomic project + API key creation
-- Creates a project and its first API key in a single transaction.
-- Catches unique violation (23505) on slug and returns a typed error row.
-- Called from the dashboard server action via the SSR client (.rpc).

create or replace function public.create_project_with_key(
  p_user_id     uuid,
  p_name        text,
  p_slug        text,
  p_description text    default null,
  p_key_hash    text,
  p_key_prefix  text
)
returns table (
  status     text,
  project_id uuid,
  key_prefix text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project_id uuid;
begin
  -- Validate caller matches the claimed user_id
  if p_user_id is distinct from auth.uid() then
    raise exception 'User ID mismatch: caller is not the claimed user'
      using errcode = 'P0001';
  end if;

  -- Insert project
  begin
    insert into public.projects (user_id, name, slug, description)
    values (p_user_id, p_name, p_slug, p_description)
    returning id into v_project_id;
  exception
    when unique_violation then
      return query select
        'slug_taken'::text,
        null::uuid,
        null::text;
      return;
  end;

  -- Insert first API key
  insert into public.api_keys (project_id, user_id, key_hash, key_prefix, label)
  values (v_project_id, p_user_id, p_key_hash, p_key_prefix, 'default');

  -- Return success
  return query select
    'ok'::text,
    v_project_id,
    p_key_prefix;
end;
$$;

-- Access control: restrict to authenticated users only.
revoke execute on function public.create_project_with_key(
  uuid, text, text, text, text, text
) from public;
revoke execute on function public.create_project_with_key(
  uuid, text, text, text, text, text
) from anon;
grant execute on function public.create_project_with_key(
  uuid, text, text, text, text, text
) to authenticated;

comment on function public.create_project_with_key(
  uuid, text, text, text, text, text
) is
  'Atomically creates a project and its first API key. Catches unique '
  'violation on (user_id, slug) and returns {status: slug_taken}. '
  'Called from dashboard server action via SSR client (.rpc).';
