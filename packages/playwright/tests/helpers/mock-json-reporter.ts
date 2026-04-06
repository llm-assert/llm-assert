import type { FullConfig, FullResult, Suite } from "@playwright/test/reporter";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { EvaluationRecord, JSONReporterConfig } from "../../src/types.js";
import LLMAssertJSONReporter from "../../src/json-reporter.js";

const EMPTY_CONFIG = { workers: 1 } as FullConfig;
const EMPTY_SUITE = { allTests: () => [] } as unknown as Suite;
const PASSED_RESULT: FullResult = {
  status: "passed",
  startTime: new Date(),
  duration: 0,
};

/**
 * Testable JSON reporter wrapper that exposes internals for assertions.
 */
export class TestableJSONReporter extends LLMAssertJSONReporter {
  getEvaluations(): ReadonlyArray<EvaluationRecord> {
    return (this as unknown as { evaluations: EvaluationRecord[] }).evaluations;
  }

  getOutputPath(): string {
    return (this as unknown as { config: { outputFile: string } }).config
      .outputFile;
  }

  begin(): void {
    this.onBegin(EMPTY_CONFIG, EMPTY_SUITE);
  }

  async end(): Promise<void> {
    await this.onEnd(PASSED_RESULT);
  }
}

/**
 * Create a temp directory for test output, returning the dir path
 * and a cleanup function.
 */
export function createTempDir(): { dir: string; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), "llmassert-test-"));
  return {
    dir,
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
}

export function createJSONReporter(
  overrides: Partial<JSONReporterConfig> = {},
): TestableJSONReporter {
  return new TestableJSONReporter(overrides);
}
