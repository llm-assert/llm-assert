---
"@llmassert/playwright": minor
---

Add local-only JSON file reporter for evaluation results

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
