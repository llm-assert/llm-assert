import type {
  FullConfig,
  FullResult,
  Reporter,
  Suite,
  TestCase,
  TestResult,
} from "@playwright/test/reporter";
import type {
  EvaluationRecord,
  IngestPayload,
  ReporterConfig,
} from "./types.js";

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

  onTestEnd(_test: TestCase, _result: TestResult) {
    // Evaluation results are attached via step metadata
    // during assertion execution — collected here for batching
  }

  async onEnd(_result: FullResult) {
    if (!this.config.apiKey) {
      // No API key — local-only mode, skip ingestion silently
      return;
    }

    if (this.evaluations.length === 0) {
      return;
    }

    const payload: IngestPayload = {
      project_slug: this.config.projectSlug,
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
