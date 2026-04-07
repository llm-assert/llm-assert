import type {
  FullConfig,
  FullResult,
  Reporter,
  Suite,
  TestCase,
  TestResult,
} from "@playwright/test/reporter";
import { randomUUID } from "node:crypto";
import {
  ATTACHMENT_NAME,
  parseEvaluationAttachment,
} from "./parse-attachment.js";
import type {
  EvaluationRecord,
  IngestPayload,
  PreflightResult,
  QuotaExceededInfo,
  ReporterConfig,
} from "./types.js";
import { log } from "./logger.js";
import { PreflightClient } from "./preflight/client.js";

/**
 * Custom Playwright reporter that sends evaluation results to the LLMAssert dashboard.
 *
 * Configure in playwright.config.ts:
 * ```ts
 * reporter: [
 *   ['list'],
 *   ['@llmassert/playwright/reporter', {
 *     apiKey: process.env.LLMASSERT_API_KEY,
 *     projectSlug: 'my-project',
 *   }],
 * ]
 * ```
 */
class LLMAssertReporter implements Reporter {
  private config: ReporterConfig;
  private evaluations: EvaluationRecord[] = [];
  private startedAt: string = "";
  private quotaExhausted: boolean = false;
  private preflightPromise: Promise<PreflightResult> | null = null;

  constructor(options: ReporterConfig) {
    this.config = {
      dashboardUrl: "https://llmassert.com",
      batchSize: 50,
      timeout: 10_000,
      retries: 1,
      onError: "warn",
      onQuotaExhausted: "warn",
      preflight: "warn",
      preflightTimeout: 5_000,
      ...options,
    };
  }

  onBegin(_config: FullConfig, _suite: Suite) {
    this.startedAt = new Date().toISOString();
    this.evaluations = [];
    this.quotaExhausted = false;
    this.preflightPromise = null;

    if (
      this.config.apiKey &&
      this.config.projectSlug &&
      this.config.preflight !== false
    ) {
      const client = new PreflightClient({
        dashboardUrl: this.config.dashboardUrl ?? "https://llmassert.com",
        apiKey: this.config.apiKey,
        projectSlug: this.config.projectSlug,
        timeout: this.config.preflightTimeout,
      });
      this.preflightPromise = client.fetch();
    } else {
      log("debug", "reporter.preflight_skipped", {
        reason: this.config.apiKey ? "disabled" : "no_api_key",
      });
    }
  }

  onTestEnd(test: TestCase, result: TestResult) {
    for (const attachment of result.attachments) {
      if (
        attachment.name !== ATTACHMENT_NAME ||
        attachment.contentType !== "application/json" ||
        !attachment.body
      ) {
        continue;
      }

      const evalData = parseEvaluationAttachment(attachment.body);
      if (!evalData) {
        this.handleError(
          `Invalid evaluation attachment in test "${test.title}" — skipping`,
        );
        continue;
      }

      this.evaluations.push({
        ...evalData,
        testName: test.title,
        testFile: test.location.file,
      });
    }
  }

  async onEnd(_result: FullResult) {
    if (!this.config.apiKey) {
      // No API key — local-only mode, skip ingestion silently
      return;
    }

    // Log cost summary before any early-return (visible even if preflight skips batches)
    if (this.evaluations.length > 0) {
      const totalCost = this.evaluations.reduce(
        (sum, e) => sum + (e.judgeCostUsd ?? 0),
        0,
      );
      const evalsWithCost = this.evaluations.filter(
        (e) => e.judgeCostUsd !== undefined,
      ).length;
      if (evalsWithCost > 0) {
        console.error(
          `[LLMAssert] Judge cost: $${totalCost.toFixed(6)} across ${evalsWithCost}/${this.evaluations.length} evaluations`,
        );
      }
    }

    // Await preflight result before sending batches
    if (this.preflightPromise) {
      const preflightResult = await this.preflightPromise;
      const shouldSkip = this.handlePreflightResult(preflightResult);
      if (shouldSkip) return;
    }

    if (this.evaluations.length === 0) {
      return;
    }

    const runId = randomUUID();

    const payload: IngestPayload = {
      project_slug: this.config.projectSlug,
      run_id: runId,
      run: {
        started_at: this.startedAt,
        finished_at: new Date().toISOString(),
        ci_provider: process.env.CI ? this.detectCIProvider() : undefined,
        ci_run_url:
          process.env.GITHUB_SERVER_URL &&
          process.env.GITHUB_REPOSITORY &&
          process.env.GITHUB_RUN_ID
            ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
            : undefined,
        branch: process.env.GITHUB_REF_NAME ?? process.env.BRANCH_NAME,
        commit_sha: process.env.GITHUB_SHA ?? process.env.COMMIT_SHA,
        metadata: this.config.metadata,
        hardening_summary: {
          total_input_rejected: this.evaluations.filter(
            (e) => e.inputTruncated || e.injectionDetected,
          ).length,
          total_rate_limited: this.evaluations.filter((e) => e.rateLimited)
            .length,
          total_backoff_ms: this.evaluations.reduce(
            (sum, e) => sum + (e.judgeBackoffMs ?? 0),
            0,
          ),
        },
      },
      evaluations: this.evaluations.map((e) => ({
        assertion_type: e.assertionType,
        test_name: e.testName,
        test_file: e.testFile,
        input_text: e.inputText,
        context_text: e.contextText,
        expected_value: e.expectedValue,
        result: e.result,
        score: e.score,
        reasoning: e.reasoning,
        judge_model: e.judgeModel,
        judge_latency_ms: e.judgeLatencyMs,
        judge_input_tokens: e.judgeInputTokens,
        judge_output_tokens: e.judgeOutputTokens,
        judge_cost_usd: e.judgeCostUsd,
        fallback_used: e.fallbackUsed,
        threshold: e.threshold,
        threshold_source: e.thresholdSource,
        input_truncated: e.inputTruncated,
        injection_detected: e.injectionDetected,
        rate_limited: e.rateLimited,
        judge_backoff_ms: e.judgeBackoffMs,
        failure_reason: e.failureReason,
      })),
    };

    // Send in batches
    const batchSize = this.config.batchSize!;
    const totalBatches = Math.ceil(payload.evaluations.length / batchSize);
    for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
      if (this.quotaExhausted) break;

      const start = batchIdx * batchSize;
      const batch: IngestPayload = {
        ...payload,
        evaluations: payload.evaluations.slice(start, start + batchSize),
      };
      const batchesRemaining = totalBatches - batchIdx - 1;
      await this.sendBatch(batch, batchesRemaining);
    }
  }

  private async sendBatch(
    payload: IngestPayload,
    batchesRemaining: number = 0,
  ): Promise<void> {
    const url = `${this.config.dashboardUrl}/api/ingest`;
    const retries = this.config.retries!;

    for (let attempt = 0; attempt <= retries; attempt++) {
      let quotaInfo: QuotaExceededInfo | undefined;
      let is429 = false;
      let is413 = false;
      let payloadSizeInfo:
        | { max_bytes?: number; actual_bytes?: number }
        | undefined;
      let finalAttemptErrorMessage: string | undefined;

      try {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.config.apiKey}`,
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(this.config.timeout!),
        });

        if (response.ok) return;

        // Payload too large — non-retryable, parse details
        if (response.status === 413) {
          is413 = true;
          try {
            const body = await response.json();
            payloadSizeInfo = body?.error?.details;
          } catch {
            // Response body not parseable
          }
          // Quota exhaustion — parse details, handle outside try/catch
        } else if (response.status === 429) {
          is429 = true;
          try {
            const body = await response.json();
            quotaInfo = body?.error?.details;
          } catch {
            // Response body not parseable — quotaInfo stays undefined
          }
        } else if (attempt === retries) {
          finalAttemptErrorMessage = `Ingest failed with status ${response.status}: ${await response.text()}`;
        }
      } catch (error) {
        if (attempt === retries) {
          finalAttemptErrorMessage = `Ingest request failed: ${error instanceof Error ? error.message : String(error)}`;
        }
      }

      // Handle all error types outside try/catch so throws propagate cleanly
      if (is413) {
        this.handlePayloadTooLarge(payloadSizeInfo, payload.evaluations.length);
        return; // only reached in 'warn'/'silent' mode
      }

      if (is429) {
        this.handleQuotaExhausted(
          quotaInfo,
          payload.evaluations.length,
          batchesRemaining,
        );
        return; // only reached in 'warn' mode
      }

      if (finalAttemptErrorMessage) {
        this.handleError(finalAttemptErrorMessage);
      }
    }
  }

  /**
   * Process the preflight result. Returns true if batch sending should be skipped.
   */
  private handlePreflightResult(result: PreflightResult): boolean {
    // Error result (auth failure, network error, timeout)
    if ("error" in result) {
      log("warn", "reporter.preflight_failed", {
        latency_ms: result.latencyMs,
        reason: result.error,
        status_code: result.statusCode,
      });

      const message = `Preflight check failed: ${result.error}`;

      if (this.config.preflight === "fail") {
        throw new Error(`[LLMAssert] ${message}`);
      }

      // For auth/project failures (401, 403, 404), skip ingestion — it would fail anyway
      if (
        result.statusCode === 401 ||
        result.statusCode === 403 ||
        result.statusCode === 404
      ) {
        console.error(`[LLMAssert] Warning: ${message}. Skipping ingestion.`);
        return true;
      }

      // For network errors (statusCode 0) and other failures, still attempt ingestion
      console.error(`[LLMAssert] Warning: ${message}`);
      return false;
    }

    // Success result — check status before logging preflight_ok
    if (result.status === "quota_exceeded") {
      log("warn", "reporter.preflight_failed", {
        latency_ms: result.latencyMs,
        reason: "quota_exceeded",
        status_code: 200,
      });
      this.handleQuotaExhausted(
        {
          evaluations_used: result.quota.evaluations_used,
          evaluation_limit: result.quota.evaluation_limit,
          plan: result.quota.plan,
        },
        this.evaluations.length,
        0,
      );
      // handleQuotaExhausted throws in 'fail' mode, otherwise returns
      return true;
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
        `[LLMAssert] Preflight: ${evaluations_used}/${evaluation_limit} evaluations used (${plan} plan). ${remaining} remaining.`,
      );
    }

    return false;
  }

  private handleQuotaExhausted(
    info: QuotaExceededInfo | undefined,
    batchSize: number,
    batchesRemaining: number,
  ): void {
    this.quotaExhausted = true;

    const used = info?.evaluations_used ?? "?";
    const limit = info?.evaluation_limit ?? "?";
    const plan = info?.plan ?? "unknown";
    const upgradeUrl =
      info?.upgrade_url ?? "https://llmassert.com/settings/billing";

    let message = `[LLMAssert] Quota exceeded: ${used}/${limit} evaluations used (${plan} plan).`;

    if (info?.next_reset_date) {
      const resetDate = new Date(info.next_reset_date).toLocaleDateString(
        undefined,
        { month: "long", day: "numeric", year: "numeric" },
      );
      message += ` Resets ${resetDate}.`;
    }

    message += ` Upgrade at ${upgradeUrl}`;

    // Structured log for machine parsing
    log("warn", "reporter.quota_exceeded", {
      evaluations_used: info?.evaluations_used,
      evaluation_limit: info?.evaluation_limit,
      plan,
      batch_size: batchSize,
      batches_remaining: batchesRemaining,
    });

    switch (this.config.onQuotaExhausted) {
      case "fail":
        throw new Error(message);
      case "warn":
      default:
        console.error(message);
        break;
    }
  }

  private handlePayloadTooLarge(
    info: { max_bytes?: number; actual_bytes?: number } | undefined,
    batchSize: number,
  ): void {
    const maxMB = info?.max_bytes
      ? (info.max_bytes / 1024 / 1024).toFixed(1)
      : "?";
    const actualMB = info?.actual_bytes
      ? (info.actual_bytes / 1024 / 1024).toFixed(2)
      : "?";

    const message =
      `Payload too large: ${actualMB} MB exceeds ${maxMB} MB limit` +
      ` (${batchSize} evaluations in batch).` +
      ` Try reducing batchSize in reporter config.`;

    // Structured log for machine parsing
    log("warn", "reporter.payload_too_large", {
      max_bytes: info?.max_bytes,
      actual_bytes: info?.actual_bytes,
      batch_size: batchSize,
    });

    this.handleError(message);
  }

  private handleError(message: string): void {
    switch (this.config.onError) {
      case "throw":
        throw new Error(`[LLMAssert] ${message}`);
      case "warn":
        console.error(`[LLMAssert] Warning: ${message}`);
        break;
      case "silent":
        break;
    }
  }

  private detectCIProvider(): string | undefined {
    if (process.env.GITHUB_ACTIONS) return "github-actions";
    if (process.env.GITLAB_CI) return "gitlab-ci";
    if (process.env.CIRCLECI) return "circleci";
    if (process.env.JENKINS_URL) return "jenkins";
    return "unknown";
  }
}

export default LLMAssertReporter;
