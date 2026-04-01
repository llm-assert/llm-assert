import type {
  FullConfig,
  FullResult,
  Suite,
  TestCase,
  TestResult,
} from "@playwright/test/reporter";
import type { EvaluationRecord } from "../../src/types.js";
import LLMAssertReporter from "../../src/reporter.js";
import type { ReporterConfig } from "../../src/types.js";

/**
 * Minimal mock factories for Playwright reporter types.
 * Only populates fields actually read by LLMAssertReporter.
 */

export function makeTestResult(
  attachments: TestResult["attachments"] = [],
): TestResult {
  return {
    retry: 0,
    parallelIndex: 0,
    workerIndex: 0,
    duration: 0,
    startTime: new Date(),
    stdout: [],
    stderr: [],
    attachments,
    status: "passed",
    steps: [],
    errors: [],
  };
}

export function makeTestResultWithEval(
  body: Record<string, unknown> | string,
): TestResult {
  const raw = typeof body === "string" ? body : JSON.stringify(body);
  return makeTestResult([
    {
      name: "llmassert-eval",
      contentType: "application/json",
      body: Buffer.from(raw),
    },
  ]);
}

export function makeTestCase(title: string, file: string = "test.ts"): TestCase {
  return {
    title,
    location: { file, line: 1, column: 1 },
    titlePath: () => [title],
    tags: [],
    annotations: [],
    ok: () => true,
    outcome: () => "expected" as const,
    id: "test-id",
    expectedStatus: "passed",
    repeatEachIndex: 0,
    retries: 0,
    timeout: 30_000,
    type: "test",
    parent: {} as Suite,
    results: [],
  } as TestCase;
}

const EMPTY_CONFIG = { workers: 1 } as FullConfig;
const EMPTY_SUITE = { allTests: () => [] } as unknown as Suite;
const PASSED_RESULT: FullResult = { status: "passed", startTime: new Date(), duration: 0 };

export const validEvalData = {
  assertionType: "groundedness",
  inputText: "test input",
  score: 0.85,
  reasoning: "Well grounded",
  result: "pass",
  judgeModel: "mock",
  judgeLatencyMs: 50,
  threshold: 0.7,
  fallbackUsed: false,
};

/**
 * Testable reporter wrapper that exposes internal evaluations
 * without requiring `as any` casts.
 */
export class TestableReporter extends LLMAssertReporter {
  getEvaluations(): ReadonlyArray<EvaluationRecord> {
    return (this as unknown as { evaluations: EvaluationRecord[] }).evaluations;
  }

  begin(): void {
    this.onBegin(EMPTY_CONFIG, EMPTY_SUITE);
  }

  async end(): Promise<void> {
    await this.onEnd(PASSED_RESULT);
  }
}

export function createReporter(
  overrides: Partial<ReporterConfig> = {},
): TestableReporter {
  return new TestableReporter({
    projectSlug: "test",
    ...overrides,
  });
}
