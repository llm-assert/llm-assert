-- SEC-10: Add quota enforcement to create_project_with_key RPC
-- Checks project_limit from subscriptions before allowing project creation.
-- Returns 'quota_exceeded' or 'no_subscription' status rows on failure.
-- Uses FOR SHARE lock on subscription row to prevent concurrent bypass.

CREATE OR REPLACE FUNCTION public.create_project_with_key(
  p_user_id     uuid,
  p_name        text,
  p_slug        text,
  p_key_hash    text,
  p_key_prefix  text,
  p_description text    default null
)
RETURNS TABLE (
  status     text,
  project_id uuid,
  key_prefix text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
SET statement_timeout = '5s'
AS $$
DECLARE
  v_project_id uuid;
  v_limit      int;
  v_count      bigint;
BEGIN
  -- Validate caller matches the claimed user_id
  IF p_user_id IS DISTINCT FROM (SELECT auth.uid()) THEN
    RAISE EXCEPTION 'User ID mismatch: caller is not the claimed user'
      USING errcode = 'P0001';
  END IF;

  -- Quota check: read project_limit with FOR SHARE lock to prevent concurrent bypass
  SELECT s.project_limit INTO v_limit
  FROM public.subscriptions s
  WHERE s.user_id = p_user_id AND s.status = 'active'
  FOR SHARE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'no_subscription'::text, null::uuid, null::text;
    RETURN;
  END IF;

  -- -1 means unlimited; otherwise check count against limit
  IF v_limit >= 0 THEN
    SELECT count(*) INTO v_count FROM public.projects WHERE user_id = p_user_id;
    IF v_count >= v_limit THEN
      RETURN QUERY SELECT 'quota_exceeded'::text, null::uuid, null::text;
      RETURN;
    END IF;
  END IF;

  -- Insert project
  BEGIN
    INSERT INTO public.projects (user_id, name, slug, description)
    VALUES (p_user_id, p_name, p_slug, p_description)
    RETURNING id INTO v_project_id;
  EXCEPTION
    WHEN unique_violation THEN
      RETURN QUERY SELECT
        'slug_taken'::text,
        null::uuid,
        null::text;
      RETURN;
  END;

  -- Insert first API key
  INSERT INTO public.api_keys (project_id, user_id, key_hash, key_prefix, label)
  VALUES (v_project_id, p_user_id, p_key_hash, p_key_prefix, 'default');

  -- Return success
  RETURN QUERY SELECT
    'ok'::text,
    v_project_id,
    p_key_prefix;
END;
$$;

-- Access control: restrict to authenticated users only.
REVOKE EXECUTE ON FUNCTION public.create_project_with_key(
  uuid, text, text, text, text, text
) FROM public;
REVOKE EXECUTE ON FUNCTION public.create_project_with_key(
  uuid, text, text, text, text, text
) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_project_with_key(
  uuid, text, text, text, text, text
) TO authenticated;

COMMENT ON FUNCTION public.create_project_with_key(
  uuid, text, text, text, text, text
)
 IS
  'Atomically creates a project and its first API key. '
  'Enforces per-plan project quota via subscriptions.project_limit '
  '(-1 = unlimited). Returns status: ok | slug_taken | quota_exceeded | '
  'no_subscription. Called from dashboard server action via SSR client (.rpc).';
