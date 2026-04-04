-- FEAT-62: Add threshold_source column to evaluations table.
-- Tracks where the effective threshold came from: 'inline' (per-matcher override),
-- 'remote' (fetched from dashboard API), or 'default' (hardcoded 0.7).
-- Nullable for backward compatibility — pre-FEAT-62 evaluations have NULL.

alter table public.evaluations
  add column threshold_source text
  check (threshold_source in ('inline', 'remote', 'default'));

comment on column public.evaluations.threshold_source is
  'Source of the threshold used: inline (per-matcher), remote (dashboard API), default (0.7). NULL for pre-FEAT-62 data.';
