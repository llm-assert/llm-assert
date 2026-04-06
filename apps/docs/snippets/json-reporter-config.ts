import { defineConfig } from "@playwright/test";

export default defineConfig({
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
  ],
});
