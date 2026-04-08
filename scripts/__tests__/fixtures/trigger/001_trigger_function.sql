-- Trigger function — R3/R4 should NOT fire (triggers are not PostgREST-callable)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.subscriptions (user_id, plan, status)
  values (NEW.id, 'free', 'active')
  on conflict (user_id) do nothing;
  return NEW;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();
