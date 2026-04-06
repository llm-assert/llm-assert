# Changelog

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
