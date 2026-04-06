import type {
  FullConfig,
  FullResult,
  Reporter,
  Suite,
  TestCase,
  TestResult,
} from "@playwright/test/reporter";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  ATTACHMENT_NAME,
  parseEvaluationAttachment,
} from "./parse-attachment.js";
import type {
  EvaluationRecord,
  IngestPayload,
  JSONReporterConfig,
} from "./types.js";

/**
 * Playwright reporter that writes LLM evaluation results to a local JSON file.
 *
 * Output format matches `IngestPayload` and can be replayed to `POST /api/ingest`
 * with a Bearer token. For runs with >500 evaluations, the ingest endpoint accepts
 * a maximum of 500 per request — split the file or use the HTTP reporter's built-in
 * batching for large runs.
 *
 * Note: Playwright silently swallows errors thrown in reporter methods. When
 * `onError: 'throw'` is set, the error is thrown but Playwright catches it —
 * the test run still completes. Use `onError: 'warn'` (default) for visible feedback.
 *
 * Configure in playwright.config.ts:
 * ```ts
 * reporter: [
 *   ['list'],
 *   ['@llmassert/playwright/json-reporter', {
 *     outputFile: 'test-results/llmassert-results.json',
 *   }],
 * ]
 * ```
 */
class LLMAssertJSONReporter implements Reporter {
  private config: Required<
    Pick<JSONReporterConfig, "outputFile" | "projectSlug" | "onError">
  > &
    Pick<JSONReporterConfig, "metadata">;
  private evaluations: EvaluationRecord[] = [];
  private startedAt: string = "";

  constructor(options: JSONReporterConfig = {}) {
    this.config = {
      outputFile:
        process.env.LLMASSERT_OUTPUT_FILE ??
        options.outputFile ??
        "test-results/llmassert-results.json",
      projectSlug: options.projectSlug ?? "local",
      onError: options.onError ?? "warn",
      metadata: options.metadata,
    };
  }

  printsToStdio() {
    return false;
  }

  onBegin(_config: FullConfig, _suite: Suite) {
    this.startedAt = new Date().toISOString();
    this.evaluations = [];
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

    // Warn if replay would exceed ingest batch limit
    if (this.evaluations.length > 500) {
      console.error(
        `[LLMAssert] Warning: ${this.evaluations.length} evaluations exceed the /api/ingest limit of 500 per request. Split the file or use the HTTP reporter for large runs.`,
      );
    }

    // Log cost summary
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

    // Write to file
    const outputPath = resolve(this.config.outputFile);
    try {
      await mkdir(dirname(outputPath), { recursive: true });
      await writeFile(outputPath, JSON.stringify(payload, null, 2) + "\n");
      console.error(
        `[LLMAssert] Results written to ${outputPath} (${this.evaluations.length} evaluations)`,
      );
    } catch (error) {
      const code =
        error instanceof Error && "code" in error
          ? ` (${(error as NodeJS.ErrnoException).code})`
          : "";
      this.handleError(
        `Failed to write results to ${outputPath}${code}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
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

export default LLMAssertJSONReporter;
