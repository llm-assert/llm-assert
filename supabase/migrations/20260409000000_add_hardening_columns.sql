-- FEAT-102: Add hardening metadata columns to evaluations table.
-- Captures judge execution context sent by the Playwright reporter since SEC-01.
-- Boolean columns use NOT NULL DEFAULT false (matches fallback_used precedent).
-- PostgreSQL 11+ stores defaults in catalog — no table rewrite for existing rows.
-- Backward compatible: pre-hardening reporters omitting these fields get false/NULL.

alter table public.evaluations
  add column input_truncated boolean not null default false,
  add column injection_detected boolean not null default false,
  add column rate_limited boolean not null default false,
  add column judge_backoff_ms int default null
    check (judge_backoff_ms is null or judge_backoff_ms >= 0),
  add column failure_reason text default null
    check (failure_reason in ('provider_error', 'rate_limited', 'timeout', 'parse_error'));

comment on column public.evaluations.input_truncated is
  'Whether input was truncated before sending to the judge. false for pre-hardening data.';
comment on column public.evaluations.injection_detected is
  'Whether prompt injection control sequences were detected and stripped. false for pre-hardening data.';
comment on column public.evaluations.rate_limited is
  'Whether rate limit backoff was incurred during evaluation. false for pre-hardening data.';
comment on column public.evaluations.judge_backoff_ms is
  'Total milliseconds spent in rate limit backoff. NULL when no backoff or pre-hardening data.';
comment on column public.evaluations.failure_reason is
  'Reason for failure or inconclusive result: provider_error, rate_limited, timeout, parse_error. NULL for successful evaluations or pre-hardening data.';
