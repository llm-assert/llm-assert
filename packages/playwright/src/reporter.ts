import type {
  FullConfig,
  FullResult,
  Reporter,
  Suite,
  TestCase,
  TestResult,
} from "@playwright/test/reporter";
import { randomUUID } from "node:crypto";
import type {
  AssertionType,
  EvaluationRecord,
  EvaluationResult,
  FailureReason,
  IngestPayload,
  ReporterConfig,
} from "./types.js";

const ATTACHMENT_NAME = "llmassert-eval";
const VALID_ASSERTION_TYPES: AssertionType[] = [
  "groundedness",
  "pii",
  "sentiment",
  "schema",
  "fuzzy",
];
const VALID_RESULTS: EvaluationResult[] = ["pass", "fail", "inconclusive"];
const VALID_FAILURE_REASONS: FailureReason[] = [
  "provider_error",
  "rate_limited",
  "timeout",
  "parse_error",
  null,
];

/** Parse and validate a JSON attachment body as a partial EvaluationRecord */
function parseEvaluationAttachment(
  body: Buffer,
): Omit<EvaluationRecord, "testName" | "testFile"> | null {
  let data: unknown;
  try {
    data = JSON.parse(body.toString());
  } catch {
    return null;
  }

  if (typeof data !== "object" || data === null) return null;

  const d = data as Record<string, unknown>;

  // Validate required fields and types
  if (d.score !== null && typeof d.score !== "number") return null;
  if (d.score !== null && (d.score < 0 || d.score > 1)) return null;
  if (typeof d.reasoning !== "string" || d.reasoning.length === 0) return null;
  if (!VALID_ASSERTION_TYPES.includes(d.assertionType as AssertionType))
    return null;
  if (!VALID_RESULTS.includes(d.result as EvaluationResult)) return null;
  if (typeof d.judgeModel !== "string") return null;
  if (typeof d.judgeLatencyMs !== "number") return null;
  if (typeof d.threshold !== "number") return null;

  // Validate optional hardening fields
  if (d.inputTruncated !== undefined && typeof d.inputTruncated !== "boolean")
    return null;
  if (
    d.injectionDetected !== undefined &&
    typeof d.injectionDetected !== "boolean"
  )
    return null;
  if (d.rateLimited !== undefined && typeof d.rateLimited !== "boolean")
    return null;
  if (
    d.judgeBackoffMs !== undefined &&
    (typeof d.judgeBackoffMs !== "number" || d.judgeBackoffMs < 0)
  )
    return null;
  if (
    d.failureReason !== undefined &&
    !VALID_FAILURE_REASONS.includes(d.failureReason as FailureReason)
  )
    return null;

  return {
    assertionType: d.assertionType as AssertionType,
    inputText: typeof d.inputText === "string" ? d.inputText : "",
    contextText: typeof d.contextText === "string" ? d.contextText : undefined,
    expectedValue:
      typeof d.expectedValue === "string" ? d.expectedValue : undefined,
    threshold: d.threshold as number,
    result: d.result as EvaluationResult,
    score: d.score as number | null,
    reasoning: d.reasoning as string,
    judgeModel: d.judgeModel as string,
    judgeLatencyMs: d.judgeLatencyMs as number,
    judgeCostUsd:
      typeof d.judgeCostUsd === "number" ? d.judgeCostUsd : undefined,
    fallbackUsed: typeof d.fallbackUsed === "boolean" ? d.fallbackUsed : false,
    inputTruncated:
      typeof d.inputTruncated === "boolean" ? d.inputTruncated : undefined,
    injectionDetected:
      typeof d.injectionDetected === "boolean"
        ? d.injectionDetected
        : undefined,
    rateLimited: typeof d.rateLimited === "boolean" ? d.rateLimited : undefined,
    judgeBackoffMs:
      typeof d.judgeBackoffMs === "number" ? d.judgeBackoffMs : undefined,
    failureReason: (d.failureReason as FailureReason) ?? undefined,
  };
}

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

  constructor(options: ReporterConfig) {
    this.config = {
      dashboardUrl: "https://llmassert.com",
      batchSize: 50,
      timeout: 10_000,
      retries: 1,
      onError: "warn",
      ...options,
    };
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
    if (!this.config.apiKey) {
      // No API key — local-only mode, skip ingestion silently
      return;
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
        judge_cost_usd: e.judgeCostUsd,
        fallback_used: e.fallbackUsed,
        threshold: e.threshold,
        input_truncated: e.inputTruncated,
        injection_detected: e.injectionDetected,
        rate_limited: e.rateLimited,
        judge_backoff_ms: e.judgeBackoffMs,
        failure_reason: e.failureReason,
      })),
    };

    // Send in batches
    const batchSize = this.config.batchSize!;
    for (let i = 0; i < payload.evaluations.length; i += batchSize) {
      const batch: IngestPayload = {
        ...payload,
        evaluations: payload.evaluations.slice(i, i + batchSize),
      };
      await this.sendBatch(batch);
    }
  }

  private async sendBatch(payload: IngestPayload): Promise<void> {
    const url = `${this.config.dashboardUrl}/api/ingest`;
    const retries = this.config.retries!;

    for (let attempt = 0; attempt <= retries; attempt++) {
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

        if (attempt === retries) {
          this.handleError(
            `Ingest failed with status ${response.status}: ${await response.text()}`,
          );
        }
      } catch (error) {
        if (attempt === retries) {
          this.handleError(
            `Ingest request failed: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
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

export default LLMAssertReporter;
