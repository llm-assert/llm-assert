-- FEAT-68: Add token count columns to evaluations table for cost tracking.
-- Both columns are nullable (NULL when usage unavailable).
-- CHECK constraints prevent zero-token inserts that would skew cost calculations.

alter table public.evaluations
  add column judge_input_tokens int default null
    check (judge_input_tokens is null or judge_input_tokens > 0),
  add column judge_output_tokens int default null
    check (judge_output_tokens is null or judge_output_tokens > 0);

comment on column public.evaluations.judge_input_tokens is
  'Input tokens consumed by the judge API call. NULL when usage unavailable (provider failure, pre-cost-tracking reporter).';
comment on column public.evaluations.judge_output_tokens is
  'Output tokens consumed by the judge API call. NULL when usage unavailable (provider failure, pre-cost-tracking reporter).';
