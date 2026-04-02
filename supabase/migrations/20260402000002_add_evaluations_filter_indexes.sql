-- Composite index for filtered evaluations queries on the run detail page.
-- Covers: no filter, type only, result only, type+result — all with created_at DESC ordering.
create index idx_evaluations_run_type_result
  on evaluations(test_run_id, assertion_type, result, created_at desc);
