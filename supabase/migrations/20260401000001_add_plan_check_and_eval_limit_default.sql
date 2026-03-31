-- Add CHECK constraint on subscriptions.plan to enforce valid tier values
alter table subscriptions
  add constraint subscriptions_plan_check
  check (plan in ('free', 'starter', 'pro', 'team'));

-- Update evaluation_limit default from 0 to 100 (free tier allowance)
alter table subscriptions
  alter column evaluation_limit set default 100;
