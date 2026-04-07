# Migration Guide

This guide covers upgrading between versions of `@llmassert/playwright`. Each section describes what changed, how to update your code, and how to verify the migration.

## Quick Reference

| Version | Type     | Summary                                                |
| ------- | -------- | ------------------------------------------------------ |
| [0.2.0] | Breaking | `score` type changed from `number` to `number \| null` |
| [0.3.0] | Additive | New `@llmassert/playwright/json-reporter` entry point  |
| [0.4.0] | Additive | `onQuotaExhausted` config option, 429 quota handling   |
| [0.5.0] | Additive | 413 Payload Too Large handling, `batchSize` tuning     |

[0.2.0]: #upgrading-to-020
[0.3.0]: #upgrading-to-030
[0.4.0]: #upgrading-to-040
[0.5.0]: #upgrading-to-050

---

## Upgrading to 0.2.0

### BREAKING: `score: number` → `score: number | null`

Inconclusive evaluations (judge unavailable, timeout, provider outage) now return `score: null` instead of `score: -1`. This affects four interfaces:

- `AssertionResult`
- `JudgeResponse`
- `EvaluationRecord`
- `IngestPayload`

**Before (0.1.x):**

```ts
if (result.score === -1) {
  /* inconclusive */
}
const pass = result.score >= threshold && result.score !== -1;
```

**After (0.2.0+):**

```ts
if (result.score === null) {
  /* inconclusive */
}
const pass = result.score !== null && result.score >= threshold;
```

### Why this changed

Using `-1` as a sentinel distorted SQL aggregations — `AVG(score)` returned artificially low values. `NULL` is the standard SQL representation for "no value" and is automatically excluded from aggregate functions.

### Silent failure warning

The reporter's attachment parser rejects `score: -1` as invalid (scores must be `null` or in the range `[0, 1]`). If you upgrade the package without updating code that produces `score: -1`, affected evaluations are **silently dropped** — the reporter emits a warning to stderr but the test still passes. You will see fewer evaluations in the dashboard with no test failure.

The ingest API also rejects `score: -1` with a `400 INVALID_PAYLOAD` response, so archived JSON reporter files from 0.1.x cannot be replayed without transformation.

### Null-safe threshold pattern

If you write custom logic that compares scores to thresholds, use this pattern:

```ts
// Safe: null is handled before the comparison
const pass = result.score !== null && result.score >= threshold;

// Unsafe: null >= 0.7 evaluates to false in JavaScript (silent wrong result)
const pass = result.score >= threshold;
```

---

## Upgrading to 0.3.0

### New: JSON file reporter

A new entry point `@llmassert/playwright/json-reporter` writes evaluation results to a local JSON file in `IngestPayload` format.

```ts
// playwright.config.ts
reporter: [
  ['list'],
  ['@llmassert/playwright/json-reporter', {
    outputFile: 'test-results/evals.json',
  }],
],
```

### Composing with the dashboard reporter

Use both reporters in the same config to get local output and dashboard ingestion:

```ts
reporter: [
  ['list'],
  ['@llmassert/playwright/json-reporter', { outputFile: 'test-results/evals.json' }],
  ['@llmassert/playwright/reporter', { apiKey: process.env.LLMASSERT_API_KEY, projectSlug: 'my-app' }],
],
```

### `projectSlug` default is not replay-compatible

The JSON reporter defaults `projectSlug` to `'local'`. If you plan to replay the JSON output to the dashboard via `curl`, set an explicit `projectSlug` that matches a project in your dashboard. The ingest API validates slugs against the pattern `/^[a-z0-9-]+$/` and requires the slug to correspond to the API key's project.

---

## Upgrading to 0.4.0

### New: `onQuotaExhausted` config option

A new `onQuotaExhausted` option controls reporter behavior when the monthly evaluation quota is exceeded (HTTP 429).

```ts
['@llmassert/playwright/reporter', {
  projectSlug: 'my-project',
  apiKey: process.env.LLMASSERT_API_KEY,
  onQuotaExhausted: 'warn', // default: log message and continue
  // onQuotaExhausted: 'fail', // throw error (see caveat below)
}],
```

| Value    | Behavior                                                                           |
| -------- | ---------------------------------------------------------------------------------- |
| `'warn'` | Log quota message to stderr, skip remaining batches                                |
| `'fail'` | Throw an error (but see the [Playwright caveat](#onerror-throw-playwright-caveat)) |

> **Naming note:** `onQuotaExhausted` uses `'fail'`, not `'throw'`. This differs from `onError` which accepts `'throw'`. The values are not interchangeable — setting `onError: 'fail'` produces a TypeScript error.

### 429 handling behavior

When the ingest API returns 429 (quota exceeded), the reporter:

1. Emits a human-readable message with plan name, usage, reset date, and upgrade URL
2. Emits a structured `reporter.quota_exceeded` log event
3. Stops retrying the current batch
4. Skips all remaining batches in the run

This applies to the HTTP dashboard reporter only. The JSON file reporter has no quota concept.

---

## Upgrading to 0.5.0

### New: 413 Payload Too Large handling

The ingest API enforces a 1 MB request body limit. If a batch exceeds this limit, the reporter:

1. Treats the 413 as non-retryable (no retry, unlike network errors)
2. Emits an actionable warning suggesting to reduce `batchSize`
3. Emits a structured `reporter.payload_too_large` log event
4. Continues with remaining batches

### `batchSize` tuning

The default `batchSize` is 50 evaluations per request. For workloads with large `input_text` or `context_text` fields (e.g., full document context), this can exceed the 1 MB limit.

**Sizing heuristic:** Estimate average bytes per evaluation. If your context passages average 10 KB each, use `batchSize: 10` to stay well under the 1 MB limit:

```ts
['@llmassert/playwright/reporter', {
  projectSlug: 'my-project',
  apiKey: process.env.LLMASSERT_API_KEY,
  batchSize: 10, // reduce from default 50 for large context workloads
}],
```

The reporter sends multiple requests sharing the same `run_id`, so reducing batch size does not affect how results appear in the dashboard.

---

## Reporter Config Comparison

This table shows every configuration option, which reporter supports it, and when it was introduced.

| Option                  | Type                            | HTTP Reporter | JSON Reporter | Default                                 | Since |
| ----------------------- | ------------------------------- | ------------- | ------------- | --------------------------------------- | ----- |
| `projectSlug`           | `string`                        | Required      | Optional      | — / `'local'`                           | 0.1.0 |
| `apiKey`                | `string`                        | Optional¹     | —             | —                                       | 0.1.0 |
| `dashboardUrl`          | `string`                        | Supported     | —             | `'https://llmassert.com'`               | 0.1.0 |
| `batchSize`             | `number`                        | Supported     | —             | `50`                                    | 0.1.0 |
| `timeout`               | `number`                        | Supported     | —             | `10000`                                 | 0.1.0 |
| `retries`               | `number`                        | Supported     | —             | `1`                                     | 0.1.0 |
| `onError`               | `'warn' \| 'throw' \| 'silent'` | Supported     | Supported     | `'warn'`                                | 0.1.0 |
| `onThresholdFetchError` | `'warn' \| 'throw' \| 'silent'` | Supported     | —             | `'warn'`                                | 0.1.0 |
| `onQuotaExhausted`      | `'warn' \| 'fail'`              | Supported     | —             | `'warn'`                                | 0.4.0 |
| `metadata`              | `Record<string, unknown>`       | Supported     | Supported     | —                                       | 0.1.0 |
| `outputFile`            | `string`                        | —             | Supported     | `'test-results/llmassert-results.json'` | 0.3.0 |

¹ Omitting `apiKey` enables local-only mode — evaluations are collected and assertions work normally, but results are not sent to the dashboard.

> **Why the asymmetry?** The JSON reporter is a local file sink. Network-related options (`dashboardUrl`, `batchSize`, `timeout`, `retries`, `onQuotaExhausted`, `onThresholdFetchError`) are intentionally omitted because they have no meaning for local file output.

> **Naming inconsistency:** `onError` accepts `'throw'` while `onQuotaExhausted` accepts `'fail'`. These values are not interchangeable. Setting `onError: 'fail'` or `onQuotaExhausted: 'throw'` produces a TypeScript error.

---

## Stability Contract

This section describes what you can rely on before 1.0.

### Stable — Matcher APIs

The five matcher call signatures and the `AssertionResult` return type shape are stable. Changes to these follow semver — breaking changes require a major version bump.

**Covered:** `toBeGroundedIn()`, `toBeFreeOfPII()`, `toMatchTone()`, `toBeFormatCompliant()`, `toSemanticMatch()`, and the `{ pass, score, reasoning }` return shape.

**Not covered:** The internal judge prompt text, model selection, and scoring rubric may change between minor versions.

### Additive — IngestPayload wire format

The `IngestPayload` type sent to `POST /api/ingest` evolves additively. New optional fields may appear in minor versions. Existing fields will not be removed or have their types narrowed.

**Covered:** All fields currently in `IngestPayload` will continue to be accepted. JSON files produced by the JSON reporter are forward-compatible with future dashboard versions.

**Not covered:** New required fields in a future `IngestPayload` would require a major version bump. The ingest API may add new optional response fields.

### Internal — Structured logger events

The structured JSON events emitted by the internal logger (`reporter.quota_exceeded`, `reporter.payload_too_large`, `judge.*` events) and `LLMASSERT_DEBUG=1` output may change without notice between any versions.

**Covered:** Nothing — these are internal implementation details.

**Not covered:** Event names, field shapes, and emission conditions. Do not build CI tooling that parses these events.

---

## Verify Your Migration

### After upgrading to 0.2.0 (score: null)

**1. Check for lingering sentinel comparisons in your code:**

```bash
grep -r "=== -1" src/ tests/
```

Any matches involving assertion results or scores need updating. An empty result means no sentinel checks remain.

**2. Run your tests and check for silent evaluation drops:**

```bash
pnpm exec playwright test 2>&1 | grep "Invalid evaluation attachment"
```

If this produces output, some evaluations are still using the old `score: -1` format and are being silently dropped. An empty result means all evaluations are valid.

### After any reporter upgrade

**3. Verify reporter connectivity (HTTP reporter):**

```bash
pnpm exec playwright test 2>&1 | grep "\[LLMAssert\]"
```

Expected output patterns:

- **Success:** `[LLMAssert] Judge cost: $0.001234 across 5/5 evaluations` — evaluations sent successfully
- **Quota warning:** `[LLMAssert] Quota exceeded: 95/100 evaluations used (free plan).` — quota limit reached
- **Payload too large:** `[LLMAssert] Warning: Payload too large: 1.25 MB exceeds 1.0 MB limit` — reduce `batchSize`
- **No output:** Either no evaluations were collected, or `apiKey` is not set (local-only mode)

### After switching to the dashboard reporter (from JSON reporter)

**4. Verify JSON replay compatibility:**

```bash
curl -s -o /dev/null -w "%{http_code}" \
  -X POST https://llmassert.com/api/ingest \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $LLMASSERT_API_KEY" \
  -d @test-results/llmassert-results.json
```

- **200:** Replay successful
- **400:** Invalid payload — check `projectSlug` format and `score` values
- **413:** File too large — the JSON reporter writes all evaluations to a single file; for runs over 500 evaluations, use the HTTP reporter's built-in batching instead

---

## Troubleshooting

### `ERR_REQUIRE_ESM` when loading the reporter

**Cause:** `@llmassert/playwright` uses `"type": "module"` in its `package.json`. If your project does not have `"type": "module"`, Node.js tries to load the reporter as CommonJS and fails.

**Fix (choose one):**

1. Add `"type": "module"` to your project's `package.json`
2. Rename your config to `playwright.config.mjs`

### `LLMASSERT_OUTPUT_FILE` overrides config

The JSON reporter resolves the output file path in this order:

1. `LLMASSERT_OUTPUT_FILE` environment variable (highest priority)
2. `outputFile` option in reporter config
3. `'test-results/llmassert-results.json'` (default)

If you switched from the JSON reporter to the HTTP reporter but still see a JSON file being written, check whether `LLMASSERT_OUTPUT_FILE` is set in your CI environment. Unset it to stop the JSON reporter from overriding your config.

The HTTP reporter has no equivalent environment variable override.

### `thresholdSource: "remote"` without configuring thresholds

When the dashboard reporter connects, it fetches thresholds from the dashboard API. A newly created project with no user-configured thresholds still returns system defaults (0.7 for all assertion types) via the API. This means `thresholdSource` will show `"remote"` even though the values are the same as the defaults.

`"remote"` means "fetched from the dashboard" — not "manually configured by the user."

### `onError: 'throw'` Playwright caveat

Playwright silently catches and swallows errors thrown in reporter lifecycle methods. When `onError: 'throw'` is set, the error is thrown but Playwright catches it — the test run still completes. In practice, `'throw'` behaves the same as `'warn'` from the test suite's perspective.

Use `onError: 'warn'` (default) for visible stderr feedback, or `onError: 'silent'` to suppress all human-readable error output.

> **Note:** Even with `onError: 'silent'`, structured logger events (`reporter.quota_exceeded`, `reporter.payload_too_large`) are still emitted to stderr. See [Console Output Reference](#console-output-reference).

---

## CI Environment Variables

The reporter auto-detects your CI provider and attaches metadata to each run.

| Provider       | Detected | Branch            | Commit SHA       | Run URL       |
| -------------- | -------- | ----------------- | ---------------- | ------------- |
| GitHub Actions | Auto     | Auto              | Auto             | Auto          |
| GitLab CI      | Auto     | Set `BRANCH_NAME` | Set `COMMIT_SHA` | Not available |
| CircleCI       | Auto     | Set `BRANCH_NAME` | Set `COMMIT_SHA` | Not available |
| Jenkins        | Auto     | Set `BRANCH_NAME` | Set `COMMIT_SHA` | Not available |

For non-GitHub CI providers, set these environment variables in your CI configuration:

```yaml
# GitLab CI example
variables:
  BRANCH_NAME: $CI_COMMIT_REF_NAME
  COMMIT_SHA: $CI_COMMIT_SHA
```

```yaml
# CircleCI example
environment:
  BRANCH_NAME: << pipeline.git.branch >>
  COMMIT_SHA: << pipeline.git.revision >>
```

For additional CI metadata (build number, pipeline URL, etc.), use the `metadata` config field:

```ts
['@llmassert/playwright/reporter', {
  projectSlug: 'my-project',
  apiKey: process.env.LLMASSERT_API_KEY,
  metadata: {
    buildNumber: process.env.BUILD_NUMBER,
    pipelineUrl: process.env.CI_PIPELINE_URL,
  },
}],
```

---

## Console Output Reference

The reporter writes to stderr using two systems. Both are always active regardless of the `onError` setting.

### Human-readable lines (`console.error`)

These lines are prefixed with `[LLMAssert]` and are intended for human consumption:

| Line pattern                                                       | Trigger                                | Reporter |
| ------------------------------------------------------------------ | -------------------------------------- | -------- |
| `[LLMAssert] Judge cost: $X.XXXXXX across N/M evaluations`         | Always (when evaluations have costs)   | Both     |
| `[LLMAssert] Results written to <path> (N evaluations)`            | Always (after writing JSON file)       | JSON     |
| `[LLMAssert] Warning: N evaluations exceed the /api/ingest limit…` | Run has >500 evaluations               | JSON     |
| `[LLMAssert] Quota exceeded: X/Y evaluations used (plan).`         | HTTP 429 from ingest API               | HTTP     |
| `[LLMAssert] Warning: Payload too large: X MB exceeds Y MB limit…` | HTTP 413 from ingest API               | HTTP     |
| `[LLMAssert] Warning: Invalid evaluation attachment in test "…"`   | Malformed attachment (e.g., score: -1) | Both     |
| `[LLMAssert] Warning: Ingest failed with status NNN: …`            | Non-retryable ingest error             | HTTP     |

### Structured JSON events (`process.stderr`)

These lines are newline-delimited JSON objects with no `[LLMAssert]` prefix. They are always emitted, even when `onError` is `'silent'`:

| Event                                | Trigger                       |
| ------------------------------------ | ----------------------------- |
| `reporter.quota_exceeded`            | HTTP 429 from ingest API      |
| `reporter.payload_too_large`         | HTTP 413 from ingest API      |
| `input.rejected.too_long`            | Input exceeds `maxInputChars` |
| `input.rejected.injection_suspected` | Prompt injection detected     |
| `judge.rate_limited`                 | Rate limit backoff triggered  |
| `judge.backoff`                      | Backoff delay applied         |
| `judge.provider_fallback`            | Fallback model used           |
| `judge.parse_error`                  | Judge response unparseable    |

### Debug mode

Set `LLMASSERT_DEBUG=1` to enable additional `debug`-level structured events:

```bash
LLMASSERT_DEBUG=1 pnpm exec playwright test
```

Debug events use the same JSON format but with `"level": "debug"`. These are intended for diagnosing judge and reporter issues during development.
