-- FEAT-33: Add CHECK constraint on pass_threshold range and harden RLS
-- with project ownership check (mirrors api_keys fix from 20260403000001).

-- 1. CHECK constraint: pass_threshold must be in [0, 1]
alter table thresholds
  add constraint threshold_range check (pass_threshold >= 0 and pass_threshold <= 1);

-- 2. RLS: add project ownership sub-check to WITH CHECK clause
drop policy if exists "Users manage own thresholds" on thresholds;

create policy "Users manage own thresholds" on thresholds for all to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and project_id in (select id from projects where user_id = (select auth.uid()))
  );
