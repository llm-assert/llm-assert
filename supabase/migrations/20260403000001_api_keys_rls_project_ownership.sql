-- Harden api_keys RLS policy: validate project ownership on INSERT/UPDATE.
-- The original policy only checks user_id = auth.uid(), which allows inserting
-- a key referencing another user's project_id. This adds a WITH CHECK clause
-- ensuring project_id belongs to the authenticated user.

drop policy "Users manage own keys" on api_keys;

create policy "Users manage own keys" on api_keys for all to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and project_id in (select id from projects where user_id = (select auth.uid()))
  );
