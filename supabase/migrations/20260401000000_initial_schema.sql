-- LLMAssert initial schema — 6 core tables with RLS

-- 1. Projects
create table projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  slug text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, slug)
);
alter table projects enable row level security;
create policy "Users manage own projects" on projects for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- 2. Test runs
create table test_runs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  started_at timestamptz not null,
  finished_at timestamptz,
  total_evaluations int not null default 0,
  passed int not null default 0,
  failed int not null default 0,
  inconclusive int not null default 0,
  ci_provider text,
  ci_run_url text,
  branch text,
  commit_sha text,
  metadata jsonb default '{}',
  created_at timestamptz not null default now()
);
alter table test_runs enable row level security;
create policy "Users manage own runs" on test_runs for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create index idx_test_runs_project on test_runs(project_id, started_at desc);

-- 3. Evaluations
create table evaluations (
  id uuid primary key default gen_random_uuid(),
  test_run_id uuid not null references test_runs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  assertion_type text not null,
  test_name text not null,
  test_file text,
  input_text text not null,
  context_text text,
  expected_value text,
  result text not null check (result in ('pass', 'fail', 'inconclusive')),
  score numeric(5,4),
  reasoning text,
  judge_model text not null,
  judge_latency_ms int,
  judge_cost_usd numeric(10,6),
  created_at timestamptz not null default now()
);
alter table evaluations enable row level security;
create policy "Users manage own evaluations" on evaluations for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create index idx_evaluations_run on evaluations(test_run_id);
create index idx_evaluations_type on evaluations(assertion_type, created_at desc);

-- 4. API keys
create table api_keys (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  key_hash text not null,
  key_prefix text not null,
  label text not null default 'default',
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
alter table api_keys enable row level security;
create policy "Users manage own keys" on api_keys for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- 5. Subscriptions
create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  stripe_customer_id text not null,
  stripe_subscription_id text unique,
  plan text not null default 'free',
  status text not null default 'active',
  current_period_start timestamptz,
  current_period_end timestamptz,
  evaluation_limit int not null default 0,
  evaluations_used int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table subscriptions enable row level security;
create policy "Users view own subscription" on subscriptions for select to authenticated
  using ((select auth.uid()) = user_id);

-- 6. Thresholds
create table thresholds (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  assertion_type text not null,
  pass_threshold numeric(5,4) not null default 0.7000,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, assertion_type)
);
alter table thresholds enable row level security;
create policy "Users manage own thresholds" on thresholds for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Triggers: auto-update updated_at
create extension if not exists moddatetime schema extensions;
create trigger handle_projects_updated_at before update on projects for each row execute procedure moddatetime(updated_at);
create trigger handle_subscriptions_updated_at before update on subscriptions for each row execute procedure moddatetime(updated_at);
create trigger handle_thresholds_updated_at before update on thresholds for each row execute procedure moddatetime(updated_at);
