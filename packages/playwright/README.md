# @llmassert/playwright

LLM-as-judge assertion matchers for [Playwright](https://playwright.dev). Test your AI outputs for hallucinations, PII leaks, tone, format compliance, and semantic accuracy.

```ts
import { test, expect } from "@llmassert/playwright";

test("chatbot response is grounded in docs", async () => {
  const response = "Our return window is 30 days from purchase.";
  const context = "Returns accepted within 30 days. No restocking fee.";

  await expect(response).toBeGroundedIn(context);
  await expect(response).toBeFreeOfPII();
  await expect(response).toMatchTone("professional and helpful");
});
```

[![npm version](https://img.shields.io/npm/v/@llmassert/playwright)](https://www.npmjs.com/package/@llmassert/playwright)
[![license](https://img.shields.io/npm/l/@llmassert/playwright)](./LICENSE)
[![node](https://img.shields.io/node/v/@llmassert/playwright)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue)](https://www.typescriptlang.org)

> **Provider outages never fail your test suite.** When the primary judge model and fallback both fail or time out, evaluations are marked `inconclusive` and the test passes. Scores and reasoning are still surfaced in the dashboard.

## Table of Contents

- [Install](#install)
- [Quick Start](#quick-start)
- [Matchers](#matchers)
  - [toBeGroundedIn](#tobegroundedin)
  - [toBeFreeOfPII](#tobefreeofpii)
  - [toMatchTone](#tomatchtone)
  - [toBeFormatCompliant](#tobeformatcompliant)
  - [toSemanticMatch](#tosemanticmatch)
- [Thresholds](#thresholds)
- [Judge Configuration](#judge-configuration)
- [JSON File Reporter](#json-file-reporter)
- [Dashboard Reporter](#dashboard-reporter)
- [CI Metadata](#ci-metadata)
- [Contributing](#contributing)
- [License](#license)

## Install

Requires [`@playwright/test`](https://www.npmjs.com/package/@playwright/test) `>=1.40.0` as a peer dependency.

```bash
pnpm add -D @llmassert/playwright
# or: npm install -D @llmassert/playwright
# or: yarn add -D @llmassert/playwright
```

Set your judge API key:

```bash
export OPENAI_API_KEY="sk-..."
```

If you want the Claude Haiku fallback judge, also install the Anthropic SDK:

```bash
pnpm add -D @anthropic-ai/sdk
export ANTHROPIC_API_KEY="sk-ant-..."
```

The `@anthropic-ai/sdk` peer dependency is optional. Without it, the fallback chain skips Claude and goes directly to `inconclusive` if the primary model fails.

## Quick Start

> **Important:** Import `test` and `expect` from `@llmassert/playwright`, not from `@playwright/test`. This gives you the LLM assertion matchers and the worker-scoped judge fixture. Your `playwright.config.ts` still uses `defineConfig` from `@playwright/test` as normal.
>
> The package provides three import paths:
>
> - `@llmassert/playwright` — `test`, `expect`, types, and `JudgeClient`
> - `@llmassert/playwright/reporter` — dashboard reporter for `playwright.config.ts`
> - `@llmassert/playwright/fixtures` — fixture-extended `test` with judge lifecycle, without custom `expect` matchers (advanced)

**1. Create a test file** (`tests/llm.spec.ts`):

```ts
import { test, expect } from "@llmassert/playwright";

test("response is grounded in source docs", async () => {
  const response = "Our return window is 30 days from purchase.";
  const context = "Returns accepted within 30 days. No restocking fee.";

  await expect(response).toBeGroundedIn(context);
});

test("response contains no PII", async () => {
  const response = "Your order #12345 has shipped.";

  await expect(response).toBeFreeOfPII();
});
```

**2. Configure the reporter** (`playwright.config.ts`):

```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  reporter: [
    ["list"],
    [
      "@llmassert/playwright/reporter",
      {
        projectSlug: "my-project",
        apiKey: process.env.LLMASSERT_API_KEY,
      },
    ],
  ],
});
```

**3. Run your tests:**

```bash
pnpm exec playwright test
# or: npx playwright test
```

## Matchers

All matchers return `{ pass: boolean, score: number | null, reasoning: string }` and support `.not` negation. A `null` score means the evaluation was `inconclusive` (judge unavailable) — the test passes rather than producing a false failure.

### `toBeGroundedIn`

Catches hallucinations by checking every claim against the provided context.

```ts
await expect(response).toBeGroundedIn(context);
await expect(response).toBeGroundedIn(context, { threshold: 0.9 });

// Negation: verify response adds information beyond the context
await expect(creativeResponse).not.toBeGroundedIn(context);
```

**Example — FAQ chatbot:**

```ts
test("chatbot answers are grounded in FAQ", async () => {
  const question = "Do you offer free shipping?";
  const response = await chatbot.ask(question);
  const faqDocs = await loadFAQ();

  await expect(response).toBeGroundedIn(faqDocs);
});
```

### `toBeFreeOfPII`

Scans for personally identifiable information (names, emails, phone numbers, addresses, etc.). Score 1.0 = no PII detected, 0.0 = definite PII present.

```ts
await expect(response).toBeFreeOfPII();
await expect(response).toBeFreeOfPII({ threshold: 0.9 });

// Negation: verify response correctly includes user details
await expect(profileSummary).not.toBeFreeOfPII();
```

**Example — customer service bot:**

```ts
test("support response does not leak customer PII", async () => {
  const response = await supportBot.reply("What is my account balance?");

  await expect(response).toBeFreeOfPII();
});
```

### `toMatchTone`

Validates that text matches a described tone or sentiment. The descriptor is a natural-language description of the expected tone.

> Results appear as assertion type `sentiment` in the dashboard.

```ts
await expect(response).toMatchTone("professional and helpful");
await expect(response).toMatchTone("empathetic", { threshold: 0.8 });

// Negation: verify response avoids a specific tone
await expect(response).not.toMatchTone("sarcastic or dismissive");
```

**Example — brand voice check:**

```ts
test("support replies maintain professional tone", async () => {
  const response = await supportBot.reply("This product is terrible!");

  await expect(response).toMatchTone("empathetic and solution-oriented");
});
```

### `toBeFormatCompliant`

Validates that text conforms to a described structural format. The `schema` parameter is a **natural-language description** of the expected format, not a JSON Schema or Zod object.

```ts
await expect(response).toBeFormatCompliant(
  "JSON object with required fields: id (number), name (string), tags (array of strings)",
);

// Negation: verify free-form output
await expect(response).not.toBeFormatCompliant("numbered list");
```

**Example — structured API response:**

```ts
test("AI generates valid product descriptions", async () => {
  const description = await ai.generateProductDescription(product);

  await expect(description).toBeFormatCompliant(
    "Three paragraphs: overview, key features as bullet list, call to action",
  );
});
```

### `toSemanticMatch`

Compares semantic similarity between candidate and reference text. Score 1.0 = identical meaning, 0.0 = completely unrelated. Useful for testing meaning-preserving transformations.

```ts
await expect(summary).toSemanticMatch(expectedSummary);
await expect(translation).toSemanticMatch(reference, { threshold: 0.8 });

// Negation: verify output is semantically distinct
await expect(newVersion).not.toSemanticMatch(oldVersion);
```

**Example — translation quality:**

```ts
test("translation preserves meaning", async () => {
  const translated = await ai.translate(originalEnglish, "es");
  const backTranslated = await ai.translate(translated, "en");

  await expect(backTranslated).toSemanticMatch(originalEnglish);
});
```

## Thresholds

Every matcher uses a threshold to determine pass/fail. Scores range from 0.0 (worst) to 1.0 (best). A score at or above the threshold passes.

Threshold sources (highest priority first):

1. **Inline** — pass `{ threshold: 0.9 }` directly to the matcher
2. **Remote** — configured per-assertion-type in the dashboard settings
3. **Default** — 0.7 for all matchers

```ts
// Inline override
await expect(response).toBeGroundedIn(context, { threshold: 0.95 });

// Uses remote threshold from dashboard (if configured), otherwise default 0.7
await expect(response).toBeGroundedIn(context);
```

The `thresholdSource` field in dashboard analytics shows which source was used for each evaluation (`inline`, `remote`, or `default`).

## Judge Configuration

The judge is the LLM that evaluates your assertions. Configure it globally via `playwright.config.ts` or per-test with `test.use()`.

### Fallback Chain

```
OPENAI_API_KEY set?
  Yes → GPT-5.4-mini (primary)
         Success → return score
         Fail    → try fallback
  No  → skip to fallback

ANTHROPIC_API_KEY set?
  Yes → Claude Haiku (fallback)
         Success → return score
         Fail    → inconclusive
  No  → inconclusive
```

Provider outages or timeouts result in `inconclusive` (score: `null`) — the test passes. Your CI is never blocked by a judge API outage.

### Environment Variables

| Variable            | Required     | Description                                                                        |
| ------------------- | ------------ | ---------------------------------------------------------------------------------- |
| `OPENAI_API_KEY`    | At least one | API key for GPT-5.4-mini (primary judge)                                           |
| `ANTHROPIC_API_KEY` | At least one | API key for Claude Haiku (fallback judge). Requires `@anthropic-ai/sdk` installed. |

At least one API key must be set. If neither is provided, all assertions return `inconclusive`.

### JudgeConfig Fields

All fields are optional. Defaults are shown below.

| Field             | Type                                                | Default                         | Description                                        |
| ----------------- | --------------------------------------------------- | ------------------------------- | -------------------------------------------------- |
| `primaryModel`    | `string`                                            | `'gpt-5.4-mini'`                | Primary judge model                                |
| `fallbackModel`   | `string`                                            | `'claude-3-5-haiku-20241022'`   | Fallback judge model                               |
| `timeout`         | `number`                                            | `10000`                         | Timeout in ms. Exceeded → `inconclusive`, not fail |
| `openaiApiKey`    | `string`                                            | `process.env.OPENAI_API_KEY`    | OpenAI API key                                     |
| `anthropicApiKey` | `string`                                            | `process.env.ANTHROPIC_API_KEY` | Anthropic API key                                  |
| `maxInputChars`   | `number`                                            | `500000`                        | Max combined input character length                |
| `inputHandling`   | `'reject' \| 'truncate'`                            | `'reject'`                      | How to handle oversized inputs                     |
| `pricing`         | `Record<string, { inputPerToken, outputPerToken }>` | Built-in table                  | Custom per-token pricing overrides (USD)           |
| `rateLimit`       | `{ requestsPerMinute, burstCapacity }`              | Disabled                        | Per-worker rate limiting for judge API calls       |

### Global Configuration

Add `judgeConfig` to the `use` block in your `playwright.config.ts` alongside your reporter configuration:

```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  use: {
    judgeConfig: {
      primaryModel: "gpt-5.4-mini",
      timeout: 5000,
    },
  },
  reporter: [
    ["list"],
    [
      "@llmassert/playwright/reporter",
      {
        projectSlug: "my-project",
        apiKey: process.env.LLMASSERT_API_KEY,
      },
    ],
  ],
});
```

### Per-test Override

Override judge settings for a specific `describe` block with `test.use()`:

```ts
import { test, expect } from "@llmassert/playwright";

test.describe("high-stakes evaluations", () => {
  test.use({ judgeConfig: { timeout: 15000 } });

  test("critical response is grounded", async () => {
    const response = "We process refunds within 5 business days.";
    const context = "Refunds are processed in 3-5 business days.";

    await expect(response).toBeGroundedIn(context, { threshold: 0.95 });
  });
});
```

## JSON File Reporter

The JSON file reporter writes evaluation results to a local file in [IngestPayload](#dashboard-reporter) format. Use it for local development, CI artifact storage, or offline review — no dashboard account needed.

```ts
// playwright.config.ts
reporter: [["list"], ["@llmassert/playwright/json-reporter"]];
```

Results are written to `test-results/llmassert-results.json` by default (already gitignored by Playwright).

### JSONReporterConfig Fields

| Field         | Type                            | Default                                 | Required | Description                                                    |
| ------------- | ------------------------------- | --------------------------------------- | -------- | -------------------------------------------------------------- |
| `outputFile`  | `string`                        | `'test-results/llmassert-results.json'` | No       | Output file path (resolved relative to `process.cwd()`)        |
| `projectSlug` | `string`                        | `'local'`                               | No       | Project identifier included in output for replay compatibility |
| `onError`     | `'warn' \| 'throw' \| 'silent'` | `'warn'`                                | No       | How to handle file write failures                              |
| `metadata`    | `Record<string, unknown>`       | —                                       | No       | Arbitrary metadata attached to the run                         |

### Environment Variable Override

Set `LLMASSERT_OUTPUT_FILE` to override the output path from your CI config:

```bash
LLMASSERT_OUTPUT_FILE=artifacts/evals.json npx playwright test
```

### Composing with the Dashboard Reporter

Use both reporters to get local output and dashboard ingestion in the same run:

```ts
reporter: [
  ["list"],
  [
    "@llmassert/playwright/json-reporter",
    { outputFile: "test-results/evals.json" },
  ],
  [
    "@llmassert/playwright/reporter",
    { apiKey: process.env.LLMASSERT_API_KEY, projectSlug: "my-app" },
  ],
];
```

### Replay to Dashboard

The JSON output is directly compatible with the ingest API. Replay a saved file:

```bash
curl -X POST https://llmassert.com/api/ingest \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $LLMASSERT_API_KEY" \
  -d @test-results/llmassert-results.json
```

> **Note:** The ingest API accepts a maximum of 500 evaluations per request. For runs exceeding this limit, the HTTP reporter automatically batches requests. The JSON reporter writes all evaluations to a single file — a warning is emitted for runs over 500.

## Dashboard Reporter

The reporter sends evaluation results to the [LLMAssert dashboard](https://llmassert.com) for trend analysis and team visibility. It is optional — matchers work without it.

Add the reporter to the `reporter` array in your `playwright.config.ts` (see [Global Configuration](#global-configuration) for a complete example).

### ReporterConfig Fields

| Field                   | Type                            | Default                   | Required | Description                                                                                  |
| ----------------------- | ------------------------------- | ------------------------- | -------- | -------------------------------------------------------------------------------------------- |
| `projectSlug`           | `string`                        | —                         | Yes      | Project identifier on the dashboard                                                          |
| `apiKey`                | `string`                        | —                         | No       | Dashboard API key. Omit for local-only mode (no ingest, no warning)                          |
| `dashboardUrl`          | `string`                        | `'https://llmassert.com'` | No       | Dashboard URL                                                                                |
| `batchSize`             | `number`                        | `50`                      | No       | Evaluations per ingest request. Larger runs send multiple requests sharing the same `run_id` |
| `timeout`               | `number`                        | `10000`                   | No       | Ingest request timeout in ms                                                                 |
| `retries`               | `number`                        | `1`                       | No       | Ingest POST retry count on network failure (does not affect judge evaluation retries)        |
| `onError`               | `'warn' \| 'throw' \| 'silent'` | `'warn'`                  | No       | How to handle ingest failures. Default `'warn'` keeps your test suite unblocked              |
| `onThresholdFetchError` | `'warn' \| 'throw' \| 'silent'` | `'warn'`                  | No       | How to handle remote threshold fetch failures (separate from `onError`)                      |
| `metadata`              | `Record<string, unknown>`       | —                         | No       | Arbitrary metadata attached to the run (not per-evaluation)                                  |

### Local-only Mode

Omit `apiKey` to run without dashboard integration. Evaluations are collected and assertions work normally — results just aren't sent to the dashboard. No warning is emitted.

```ts
['@llmassert/playwright/reporter', {
  projectSlug: 'my-project',
  // No apiKey — local-only mode
}],
```

## CI Metadata

The reporter auto-detects your CI provider and attaches metadata to each run.

| Field       | GitHub Actions    | GitLab CI / CircleCI / Jenkins |
| ----------- | ----------------- | ------------------------------ |
| CI provider | Auto-detected     | Auto-detected                  |
| Branch      | `GITHUB_REF_NAME` | Set `BRANCH_NAME` env var      |
| Commit SHA  | `GITHUB_SHA`      | Set `COMMIT_SHA` env var       |
| Run URL     | Auto-generated    | Not available                  |

For non-GitHub CI providers, set `BRANCH_NAME` and `COMMIT_SHA` environment variables in your CI configuration to populate branch and commit metadata in the dashboard.

## Contributing

Found a bug or have a feature request? [Open an issue](https://github.com/llm-assert/llm-assert/issues).

## License

[MIT](./LICENSE)

---

The five matcher APIs are stable. Reporter payload shape may evolve before 1.0.
