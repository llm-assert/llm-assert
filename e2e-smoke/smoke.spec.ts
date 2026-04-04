import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";
import type { SmokeState } from "./smoke-setup";

const STATE_PATH = path.resolve(__dirname, ".smoke-state.json");

function loadState(): SmokeState {
  if (!existsSync(STATE_PATH)) {
    throw new Error(
      "Smoke state not found. Did smoke-setup.ts run? Check globalSetup.",
    );
  }
  return JSON.parse(readFileSync(STATE_PATH, "utf-8"));
}

test.describe("e2e smoke test", () => {
  let state: SmokeState;

  test.beforeAll(() => {
    state = loadState();
  });

  test("full flow: ingest → dashboard → eval detail", async ({
    page,
    request,
  }) => {
    const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

    // ------------------------------------------------------------------
    // Step 1: Get evaluation data into the system
    // ------------------------------------------------------------------
    if (process.env.OPENAI_API_KEY) {
      // Real mode: spawn inner Playwright test with LLM judge calls
      await test.step("run inner fixture test with real LLM judge", async () => {
        try {
          execFileSync(
            "pnpm",
            [
              "exec",
              "playwright",
              "test",
              "--config",
              "fixture-test/playwright.config.ts",
            ],
            {
              cwd: __dirname,
              env: {
                // Only pass required env vars to the subprocess — avoid leaking
                // service-role keys or other secrets to the inner test process.
                PATH: process.env.PATH,
                HOME: process.env.HOME,
                NODE_ENV: process.env.NODE_ENV,
                OPENAI_API_KEY: process.env.OPENAI_API_KEY,
                ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
                SMOKE_API_KEY: state.apiKeyRaw,
                SMOKE_PROJECT_SLUG: state.projectSlug,
                SMOKE_DASHBOARD_URL: baseURL,
              },
              stdio: "pipe",
              timeout: 90_000,
            },
          );
        } catch (error: unknown) {
          // execFileSync throws an error with stderr/stdout Buffers on non-zero exit,
          // but may throw a plain Error if the command is not found.
          const stderr =
            (error as { stderr?: Buffer }).stderr?.toString?.() ??
            (error instanceof Error ? error.message : String(error));
          const stdout =
            (error as { stdout?: Buffer }).stdout?.toString?.() ?? "";
          throw new Error(`Inner fixture test failed:\n${stderr}\n${stdout}`);
        }
      });
    } else {
      // Fallback mode: POST synthetic evaluation data directly
      await test.step("post synthetic evaluation data (no OPENAI_API_KEY)", async () => {
        const runId = randomUUID();
        const response = await request.post(`${baseURL}/api/ingest`, {
          headers: { Authorization: `Bearer ${state.apiKeyRaw}` },
          data: {
            project_slug: state.projectSlug,
            run_id: runId,
            run: {
              started_at: new Date().toISOString(),
              finished_at: new Date().toISOString(),
            },
            evaluations: [
              {
                assertion_type: "groundedness",
                test_name: "pass: verbatim quote from context",
                input_text:
                  "The capital of France is Paris. The Eiffel Tower was built in 1889.",
                context_text:
                  "The capital of France is Paris. It has been the capital since the 10th century. Paris is known for the Eiffel Tower, which was built in 1889.",
                result: "pass",
                score: 0.95,
                reasoning: "Synthetic smoke test — pass case",
                judge_model: "synthetic",
                judge_latency_ms: 0,
                fallback_used: false,
                threshold: 0.7,
              },
              {
                assertion_type: "groundedness",
                test_name: "fail: contradicts context",
                input_text:
                  "The capital of France is Lyon. The Eiffel Tower was built in 1920.",
                context_text:
                  "The capital of France is Paris. It has been the capital since the 10th century. Paris is known for the Eiffel Tower, which was built in 1889.",
                result: "fail",
                score: 0.15,
                reasoning: "Synthetic smoke test — fail case",
                judge_model: "synthetic",
                judge_latency_ms: 0,
                fallback_used: false,
                threshold: 0.7,
              },
            ],
          },
        });

        expect(response.status()).toBe(200);
        const body = await response.json();
        expect(body.evaluations_ingested).toBe(2);
      });
    }

    // ------------------------------------------------------------------
    // Step 2: Navigate dashboard and verify data appeared
    // ------------------------------------------------------------------

    // Dashboard Server Components re-fetch on navigation. After ingest
    // completes, we navigate to the project page — the 15s timeout on
    // toBeVisible() provides ample time for the data to appear.
    await test.step("verify run appears on project overview", async () => {
      await page.goto(`/projects/${state.projectSlug}`);

      // Wait for the runs table to load with data
      const runsTable = page.getByTestId("recent-runs-table");
      await expect(runsTable).toBeVisible({ timeout: 15_000 });

      // There should be at least one run row
      const runRows = runsTable.locator("[data-testid^='run-row-']");
      await expect(runRows.first()).toBeVisible();
    });

    // ------------------------------------------------------------------
    // Step 3: Navigate to run detail
    // ------------------------------------------------------------------
    await test.step("verify run detail shows pass + fail", async () => {
      // Click "View all runs" to go to the runs list, then click the first run
      await page.getByRole("link", { name: "View all runs" }).click();
      await page.waitForURL(/\/projects\/[^/]+\/runs/);

      // Click the first run row (entire row is a link via after:absolute overlay)
      const firstRunRow = page.locator("[data-testid^='run-row-']").first();
      await expect(firstRunRow).toBeVisible();
      await firstRunRow.getByRole("link").first().click();
      await page.waitForURL(/\/runs\/[^/]+$/);

      // Verify RunSummary
      const runSummary = page.getByTestId("run-summary");
      await expect(runSummary).toBeVisible();

      // Verify evaluations table
      const evalsTable = page.getByTestId("evals-table");
      await expect(evalsTable).toBeVisible();

      // Should have eval rows
      const evalRows = evalsTable.locator("[data-testid^='eval-row-']");
      await expect(evalRows.first()).toBeVisible();
    });

    // ------------------------------------------------------------------
    // Step 4: Navigate to evaluation detail
    // ------------------------------------------------------------------
    await test.step("verify evaluation detail shows reasoning", async () => {
      // Click the first evaluation's test name link
      const evalsTable = page.getByTestId("evals-table");
      const firstEvalLink = evalsTable.getByRole("link").first();
      await firstEvalLink.click();
      await page.waitForURL(/\/evaluations\/[^/]+$/);

      // Verify metadata panel
      const metadataPanel = page.getByTestId("eval-metadata-panel");
      await expect(metadataPanel).toBeVisible();

      // Verify content panel with reasoning
      const contentPanel = page.getByTestId("eval-content-panel");
      await expect(contentPanel).toBeVisible();

      // Reasoning section should be visible and have content
      const reasoningHeading = contentPanel.getByText("Reasoning", {
        exact: true,
      });
      await expect(reasoningHeading).toBeVisible();
    });
  });
});
