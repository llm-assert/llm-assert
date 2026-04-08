-- SEC-10: Add project_limit column to subscriptions table
-- Enforces per-plan project limits (free:1, starter:3, pro:10, team:unlimited).
-- -1 sentinel value means unlimited (team plan).

-- Step 1: Add column with sensible default (free-tier = 1 project)
ALTER TABLE public.subscriptions
  ADD COLUMN project_limit int NOT NULL DEFAULT 1;

COMMENT ON COLUMN public.subscriptions.project_limit IS
  'Maximum number of projects allowed for this subscription. '
  '-1 means unlimited (team plan). Enforced by create_project_with_key RPC.';

-- Step 2: Backfill existing rows based on current plan
UPDATE public.subscriptions
SET project_limit = CASE plan
  WHEN 'free'    THEN 1
  WHEN 'starter' THEN 3
  WHEN 'pro'     THEN 10
  WHEN 'team'    THEN -1
  ELSE 1
END;

-- Step 3: Update handle_new_user() trigger to include project_limit in INSERT
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.subscriptions (user_id, plan, status, evaluation_limit, evaluations_used, project_limit)
  VALUES (NEW.id, 'free', 'active', 100, 0, 1)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;
