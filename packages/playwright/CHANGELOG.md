# Changelog

## 0.2.0 (2026-04-01)

### Breaking Changes

- **`score` type changed from `number` to `number | null`** across all public interfaces (`AssertionResult`, `JudgeResponse`, `EvaluationRecord`, `IngestPayload`). Inconclusive evaluations now return `score: null` instead of `score: -1`.
- Reporter validation no longer accepts `score: -1`. The sentinel value `-1` is rejected as invalid.

### Migration

Replace `score === -1` checks with `score === null`:

```diff
- if (result.score === -1) { /* inconclusive */ }
+ if (result.score === null) { /* inconclusive */ }

- const pass = result.score >= threshold && result.score !== -1;
+ const pass = result.score !== null && result.score >= threshold;
```

### Why

Using `-1` as a sentinel distorted SQL aggregations (`AVG(score)` returned artificially low values). `NULL` is the standard SQL representation for "no value" and is automatically excluded from aggregate functions.

## 0.1.0 (2026-03-31)

Initial release.
