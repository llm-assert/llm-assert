import { test as base, type FullConfig } from "@playwright/test";
import type {
  JudgeConfig,
  LLMAssertFixture,
  LLMAssertOptions,
  ReporterConfig,
} from "./types.js";
import { DEFAULT_CONFIG, JudgeClient } from "./judge/client.js";
import { setWorkerJudgeClient } from "./singleton.js";
import { ThresholdClient, setWorkerThresholds } from "./threshold/client.js";

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
/**
 * Extract ReporterConfig from the Playwright config's reporter array.
 * Finds the entry matching '@llmassert/playwright/reporter' and returns its options.
 *
 * Matches both direct package names and resolved paths (e.g. require.resolve output)
 * by checking if the reporter name ends with the package reporter path.
 */
const REPORTER_SUFFIX = "@llmassert/playwright/reporter";

function extractReporterConfig(
  config: FullConfig,
): Partial<ReporterConfig> | null {
  for (const entry of config.reporter) {
    if (!Array.isArray(entry)) continue;
    const [name, options] = entry;
    if (
      typeof name === "string" &&
      (name === REPORTER_SUFFIX || name.endsWith(`/${REPORTER_SUFFIX}`))
    ) {
      return (options as Partial<ReporterConfig>) ?? null;
    }
  }
  return null;
}

export const test = base.extend<
  { llmAssert: LLMAssertFixture },
  {
    judgeConfig: Partial<JudgeConfig>;
    _workerJudge: void;
    _workerThresholds: void;
  }
>({
  // Configurable via playwright.config.ts use: { judgeConfig: { ... } }
  judgeConfig: [{}, { option: true, scope: "worker" }],

  // Auto worker fixture: fetches thresholds from dashboard when configured
  _workerThresholds: [
    async ({}, use, workerInfo) => {
      const reporterConfig = extractReporterConfig(workerInfo.config);

      if (
        reporterConfig?.dashboardUrl &&
        reporterConfig?.apiKey &&
        reporterConfig?.projectSlug
      ) {
        const onError = reporterConfig.onThresholdFetchError ?? "warn";
        try {
          const client = new ThresholdClient({
            dashboardUrl: reporterConfig.dashboardUrl,
            apiKey: reporterConfig.apiKey,
            projectSlug: reporterConfig.projectSlug,
          });
          const thresholds = await client.fetch();
          setWorkerThresholds(thresholds);
        } catch (err) {
          const message = `[LLMAssert] Dashboard thresholds unavailable: ${err instanceof Error ? err.message : String(err)}. Using defaults.`;
          switch (onError) {
            case "throw":
              throw new Error(message);
            case "warn":
              console.warn(message);
              break;
            case "silent":
              break;
          }
        }
      }

      await use();
      setWorkerThresholds(null);
    },
    { scope: "worker", auto: true },
  ],

  // Auto worker fixture: creates JudgeClient, sets module-level singleton
  _workerJudge: [
    async ({ judgeConfig }, use) => {
      const config: JudgeConfig = {
        ...judgeConfig,
        openaiApiKey: judgeConfig.openaiApiKey ?? process.env.OPENAI_API_KEY,
        anthropicApiKey:
          judgeConfig.anthropicApiKey ?? process.env.ANTHROPIC_API_KEY,
      };

      if (!config.openaiApiKey && !config.anthropicApiKey) {
        console.warn(
          "llmAssert: No LLM API keys configured (OPENAI_API_KEY, ANTHROPIC_API_KEY). All assertions will return inconclusive.",
        );
      } else if (!config.openaiApiKey) {
        console.warn(
          "llmAssert: OPENAI_API_KEY is not set. Assertions will use Anthropic fallback.",
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
      primaryModel: judgeConfig.primaryModel ?? DEFAULT_CONFIG.primaryModel,
      fallbackModel: judgeConfig.fallbackModel ?? DEFAULT_CONFIG.fallbackModel,
      timeout: judgeConfig.timeout ?? DEFAULT_CONFIG.timeout,
      openaiApiKey: judgeConfig.openaiApiKey ?? process.env.OPENAI_API_KEY,
      anthropicApiKey:
        judgeConfig.anthropicApiKey ?? process.env.ANTHROPIC_API_KEY,
    };
    await use({ judgeConfig: resolved });
  },
});
