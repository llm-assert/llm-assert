import { PreflightClient } from "./client.js";
import { log } from "../logger.js";

export interface PreflightCheckConfig {
  apiKey: string;
  projectSlug: string;
  dashboardUrl?: string;
  timeout?: number;
}

/**
 * Standalone pre-flight check for use in Playwright's `globalSetup`.
 *
 * Unlike the reporter's built-in preflight (which warns and continues),
 * this function **throws** on any failure — stopping the test suite
 * before any tests or judge calls run.
 *
 * ```ts
 * // playwright.config.ts
 * import { preflightCheck } from '@llmassert/playwright';
 *
 * export default defineConfig({
 *   globalSetup: async () => {
 *     await preflightCheck({
 *       apiKey: process.env.LLMASSERT_API_KEY!,
 *       projectSlug: 'my-project',
 *     });
 *   },
 * });
 * ```
 */
export async function preflightCheck(
  config: PreflightCheckConfig,
): Promise<void> {
  const client = new PreflightClient({
    dashboardUrl: config.dashboardUrl ?? "https://llmassert.com",
    apiKey: config.apiKey,
    projectSlug: config.projectSlug,
    timeout: config.timeout ?? 5_000,
  });

  const result = await client.fetch();

  if ("error" in result) {
    log("warn", "reporter.preflight_failed", {
      latency_ms: result.latencyMs,
      reason: result.error,
      status_code: result.statusCode,
    });
    throw new Error(`[LLMAssert] Pre-flight check failed: ${result.error}`);
  }

  if (result.status === "quota_exceeded") {
    const { evaluations_used, evaluation_limit, plan } = result.quota;
    log("warn", "reporter.preflight_failed", {
      latency_ms: result.latencyMs,
      reason: "quota_exceeded",
      status_code: 200,
    });
    throw new Error(
      `[LLMAssert] Pre-flight check failed: Quota exceeded — ${evaluations_used}/${evaluation_limit} evaluations used (${plan} plan).`,
    );
  }

  log("debug", "reporter.preflight_ok", {
    latency_ms: result.latencyMs,
    status: result.status,
    quota_used: result.quota.evaluations_used,
    quota_limit: result.quota.evaluation_limit,
  });

  if (result.status === "quota_warning") {
    const { evaluations_used, evaluation_limit, plan } = result.quota;
    const remaining = evaluation_limit - evaluations_used;
    console.error(
      `[LLMAssert] Preflight warning: ${evaluations_used}/${evaluation_limit} evaluations used (${plan} plan). ${remaining} remaining.`,
    );
  }
}
