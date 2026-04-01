-- FEAT-61: Constrain evaluations.score to [0, 1], use NULL for inconclusive
-- FEAT-77: Add fallback_used and threshold columns (bundled — same table, no data)

-- Score range: CHECK constraints pass NULLs automatically per PostgreSQL spec,
-- so NULL (inconclusive) is permitted without explicit allowance.
ALTER TABLE evaluations
  ADD CONSTRAINT score_range CHECK (score >= 0 AND score <= 1);

-- Score-result consistency: only inconclusive evaluations may have NULL scores.
-- Prevents logical inconsistencies like result='pass' with score=NULL.
ALTER TABLE evaluations
  ADD CONSTRAINT score_result_consistency CHECK (result = 'inconclusive' OR score IS NOT NULL);

-- FEAT-77: Reporter sends both fields in every IngestPayload but no target columns existed.
ALTER TABLE evaluations
  ADD COLUMN fallback_used boolean NOT NULL DEFAULT false;

ALTER TABLE evaluations
  ADD COLUMN threshold numeric(5,4);
