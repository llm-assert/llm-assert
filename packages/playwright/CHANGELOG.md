# Changelog

## 0.7.1

### Patch Changes

- [#99](https://github.com/llm-assert/llm-assert/pull/99) [`9d8ade0`](https://github.com/llm-assert/llm-assert/commit/9d8ade0b40d5b2514c3533fccf915b312b0df954) Thanks [@Cporter97](https://github.com/Cporter97)! - Add package export validation with attw, publint, runtime import/require checks, and type declaration verification

## 0.7.0

### Minor Changes

- [#91](https://github.com/llm-assert/llm-assert/pull/91) [`7d59a89`](https://github.com/llm-assert/llm-assert/commit/7d59a89bd4bae2a232d16e5c504a2d990032525f) Thanks [@Cporter97](https://github.com/Cporter97)! - Make judge rate-limit parameters configurable via environment variables

  Rate-limit defaults (burst capacity, requests per minute, backoff base delay, max 429 retries) are now read from `LLMASSERT_*` environment variables instead of being hardcoded. This keeps sensitive tuning parameters out of committed source while maintaining backward compatibility — if the env vars are unset, the same defaults apply.

## 0.6.0

### Minor Changes

- [#85](https://github.com/llm-assert/llm-assert/pull/85) [`dd265ba`](https://github.com/llm-assert/llm-assert/commit/dd265ba43f37b3a32f78176a58c15beca678192c) Thanks [@Cporter97](https://github.com/Cporter97)! - Add pre-flight health check to reporter — validates API key, project slug, and quota status before judge calls run. New `preflight` config option (`'warn'` | `'fail'` | `false`), `preflightTimeout` option, and exported `preflightCheck()` function for `globalSetup` fail-fast.

## 0.5.1

### Patch Changes

- [#82](https://github.com/llm-assert/llm-assert/pull/82) [`0f8cb78`](https://github.com/llm-assert/llm-assert/commit/0f8cb78bb1bc75f6c05004dc3e677e92a600a616) Thanks [@Cporter97](https://github.com/Cporter97)! - Add MIGRATION.md with version-by-version upgrade guide, reporter config comparison table, stability contract, troubleshooting section, and verification checklist (DX-59)

## 0.5.0

### Minor Changes

- [#79](https://github.com/llm-assert/llm-assert/pull/79) [`b604c15`](https://github.com/llm-assert/llm-assert/commit/b604c15eb4649de47d6be23e1cc6b62b3834bf4b) Thanks [@Cporter97](https://github.com/Cporter97)! - Add 413 Payload Too Large handling: reporter treats oversized payload rejections as non-retryable with actionable guidance to reduce batchSize (SEC-13)

## 0.4.0

### Minor Changes

- [#75](https://github.com/llm-assert/llm-assert/pull/75) [`0f377fa`](https://github.com/llm-assert/llm-assert/commit/0f377fad45aee5100b4917a797edf16f79f9ff9d) Thanks [@Cporter97](https://github.com/Cporter97)! - Add quota exhaustion UX for free tier users
  - Reporter detects HTTP 429 QUOTA_EXCEEDED and emits human-readable message with plan, reset date, and upgrade URL (instead of raw JSON)
  - New `onQuotaExhausted` config option (`'warn'` | `'fail'`) to control CI behavior on quota exhaustion
  - Reporter stops retrying after 429 and skips remaining batches
  - Structured `reporter.quota_exceeded` log event for machine parsing
  - New `QuotaExceededInfo` type exported from `@llmassert/playwright`

## 0.3.1

### Patch Changes

- [#68](https://github.com/llm-assert/llm-assert/pull/68) [`98fb652`](https://github.com/llm-assert/llm-assert/commit/98fb652e4261e42bd519ac174a2c12474f99d171) Thanks [@Cporter97](https://github.com/Cporter97)! - Add `.env.example` documenting all environment variables for npm consumers (judge API keys, reporter config, debug flags) and include it in the published tarball

## 0.3.0

### Minor Changes

- [#63](https://github.com/llm-assert/llm-assert/pull/63) [`e5590c2`](https://github.com/llm-assert/llm-assert/commit/e5590c237c5bce42d681315340390008f343ecde) Thanks [@Cporter97](https://github.com/Cporter97)! - Add local-only JSON file reporter for evaluation results

  New `@llmassert/playwright/json-reporter` entry point that writes LLM evaluation results to a local JSON file in IngestPayload format. Supports replay to the dashboard API, CI artifact workflows, and offline review.

  Configure in `playwright.config.ts`:

  ```ts
  reporter: [
    ["list"],
    [
      "@llmassert/playwright/json-reporter",
      { outputFile: "test-results/evals.json" },
    ],
  ];
  ```

## 0.2.3

### Patch Changes

- [#55](https://github.com/llm-assert/llm-assert/pull/55) [`dc3c3e9`](https://github.com/llm-assert/llm-assert/commit/dc3c3e94b77abc47c404004a1a1dfdf6f4c35f07) Thanks [@Cporter97](https://github.com/Cporter97)! - Add package README.md for npm landing page with install guide, quick start, all 5 matcher examples, judge configuration, dashboard reporter configuration, and CI metadata documentation.

## 0.2.2

### Patch Changes

- [#32](https://github.com/llm-assert/llm-assert/pull/32) [`8466bce`](https://github.com/llm-assert/llm-assert/commit/8466bce7371f0765e33f03426260b9329eadebef) Thanks [@Cporter97](https://github.com/Cporter97)! - Verify npm trusted publishing pipeline

## 0.2.1

### Patch Changes

- [#29](https://github.com/llm-assert/llm-assert/pull/29) [`4cf9006`](https://github.com/llm-assert/llm-assert/commit/4cf90063a6fd399ea27cd51403980cf4cadbb8f3) Thanks [@Cporter97](https://github.com/Cporter97)! - Verify changesets release pipeline

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
