import { defineConfig } from "@playwright/test";
import path from "node:path";

/**
 * Inner Playwright config for the smoke test fixture.
 * This config attaches the LLMAssertReporter and uses the built plugin package.
 * It does NOT start a web server — the outer smoke test handles that.
 *
 * Environment variables (set by the outer smoke test):
 * - SMOKE_API_KEY: Raw API key for the test project
 * - SMOKE_PROJECT_SLUG: Project slug for the ingest payload
 * - SMOKE_DASHBOARD_URL: Dashboard base URL (e.g., http://localhost:3000)
 */
export default defineConfig({
  testDir: ".",
  testMatch: /smoke-assertions\.spec\.ts/,
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [
    ["list"],
    [
      path.resolve(__dirname, "../../packages/playwright/dist/reporter.js"),
      {
        apiKey: process.env.SMOKE_API_KEY,
        projectSlug: process.env.SMOKE_PROJECT_SLUG,
        dashboardUrl:
          process.env.SMOKE_DASHBOARD_URL ?? "http://localhost:3000",
        onError: "throw",
      },
    ],
  ],
});
