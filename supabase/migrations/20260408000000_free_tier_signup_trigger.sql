-- FEAT-126: Auto-create free-tier subscription on signup
-- All changes in a single migration for atomicity.

-- Step 1: Make stripe_customer_id nullable (free-tier users have no Stripe customer)
ALTER TABLE public.subscriptions ALTER COLUMN stripe_customer_id DROP NOT NULL;

-- Step 2: Replace column-level UNIQUE with partial unique index (NULL-safe)
ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_stripe_customer_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_stripe_customer_id_unique
  ON public.subscriptions (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

-- Step 3: Add UNIQUE(user_id) — one user, one subscription row
ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_user_id_unique UNIQUE (user_id);

-- Step 4: Trigger function — SECURITY DEFINER with empty search_path
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.subscriptions (user_id, plan, status, evaluation_limit, evaluations_used)
  VALUES (NEW.id, 'free', 'active', 100, 0)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Step 5: Wire trigger to auth.users INSERT (OR REPLACE for idempotent replay on PG 14+)
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Step 6: Backfill existing users without subscriptions (idempotent)
INSERT INTO public.subscriptions (user_id, plan, status, evaluation_limit, evaluations_used)
SELECT id, 'free', 'active', 100, 0
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM public.subscriptions)
ON CONFLICT (user_id) DO NOTHING;
