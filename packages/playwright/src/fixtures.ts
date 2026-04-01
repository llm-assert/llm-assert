import { test as base } from "@playwright/test";
import type {
  JudgeConfig,
  LLMAssertFixture,
  LLMAssertOptions,
} from "./types.js";
import { JudgeClient } from "./judge/client.js";
import { setWorkerJudgeClient } from "./singleton.js";

export type { LLMAssertFixture, LLMAssertOptions };

/**
 * Fixture-extended test with worker-scoped judge configuration.
 *
 * Import alongside `expect` from the main entry:
 * ```ts
 * import { test, expect } from '@llmassert/playwright';
 * ```
 *
 * Configure via playwright.config.ts (auto-completes `judgeConfig`):
 * ```ts
 * export default defineConfig({
 *   use: {
 *     judgeConfig: { primaryModel: 'gpt-5.4-mini', timeout: 5000 },
 *   },
 * });
 * ```
 *
 * Or override per describe block:
 * ```ts
 * test.describe(() => {
 *   test.use({ judgeConfig: { primaryModel: 'gpt-5.4' } });
 *   // tests here use gpt-5.4
 * });
 * ```
 */
export const test = base.extend<
  { llmAssert: LLMAssertFixture },
  { judgeConfig: Partial<JudgeConfig>; _workerJudge: void }
>({
  // Configurable via playwright.config.ts use: { judgeConfig: { ... } }
  judgeConfig: [{}, { option: true, scope: "worker" }],

  // Auto worker fixture: creates JudgeClient, sets module-level singleton
  _workerJudge: [
    async ({ judgeConfig }, use) => {
      const config: JudgeConfig = {
        ...judgeConfig,
        openaiApiKey: judgeConfig.openaiApiKey ?? process.env.OPENAI_API_KEY,
        anthropicApiKey:
          judgeConfig.anthropicApiKey ?? process.env.ANTHROPIC_API_KEY,
      };

      if (!config.openaiApiKey) {
        console.warn(
          "llmAssert: OPENAI_API_KEY is not set. All assertions will return inconclusive.",
        );
      }

      const client = new JudgeClient(config);
      setWorkerJudgeClient(client);
      await use();
      setWorkerJudgeClient(null);
    },
    { scope: "worker", auto: true },
  ],

  // Test-scoped fixture for direct access to resolved config
  llmAssert: async ({ judgeConfig }, use) => {
    const resolved: JudgeConfig = {
      primaryModel: judgeConfig.primaryModel ?? "gpt-5.4-mini",
      fallbackModel: judgeConfig.fallbackModel ?? "claude-haiku",
      timeout: judgeConfig.timeout ?? 10_000,
      openaiApiKey: judgeConfig.openaiApiKey ?? process.env.OPENAI_API_KEY,
      anthropicApiKey:
        judgeConfig.anthropicApiKey ?? process.env.ANTHROPIC_API_KEY,
    };
    await use({ judgeConfig: resolved });
  },
});
