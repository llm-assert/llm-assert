-- DDL-only migration with no function definitions
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS cancel_at_period_end boolean DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions (status);
