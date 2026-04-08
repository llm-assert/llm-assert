/**
 * Type consumer fixture — validates declaration files resolve correctly.
 *
 * This file is NOT executed at runtime. It is compiled with tsc --noEmit
 * to verify that .d.ts/.d.cts files are structurally valid and internally
 * consistent (e.g., hashed type chunk references like types-DoVrbHT2.d.ts
 * remain valid after rebuilds).
 *
 * Run after building:
 *   pnpm run build && pnpm exec tsc -p scripts/tsconfig.check-exports.json
 */

// Main entry types
import type {
  AssertionResult,
  EvaluationRecord,
  HardenedResult,
  JudgeConfig,
  JSONReporterConfig,
  LLMAssertFixture,
  LLMAssertOptions,
  PreflightResult,
  ReporterConfig,
  FailureReason,
  ThresholdSource,
  RemoteThresholds,
  TokenUsage,
} from "@llmassert/playwright";

// Main entry values — satisfies verifies types, not just resolution
import {
  expect,
  test,
  JudgeClient,
  calculateCostUsd,
  preflightCheck,
} from "@llmassert/playwright";

// Reporter subpath
import Reporter from "@llmassert/playwright/reporter";

// JSON reporter subpath
import JSONReporter from "@llmassert/playwright/json-reporter";

// Fixtures subpath
import type { LLMAssertOptions as FixtureOptions } from "@llmassert/playwright/fixtures";
import { test as fixtureTest } from "@llmassert/playwright/fixtures";

// Preflight subpath
import type { PreflightCheckConfig } from "@llmassert/playwright/preflight";
import { preflightCheck as preflightCheckFn } from "@llmassert/playwright/preflight";

// Verify value exports are callable/constructable
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFn = (...args: any[]) => any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClass = new (...args: any[]) => any;

void (expect satisfies AnyFn);
void (test satisfies AnyFn);
void (JudgeClient satisfies AnyClass);
void (calculateCostUsd satisfies AnyFn);
void (preflightCheck satisfies AnyFn);
void (Reporter satisfies AnyClass);
void (JSONReporter satisfies AnyClass);
void (fixtureTest satisfies AnyFn);
void (preflightCheckFn satisfies AnyFn);

// Verify type-only exports are structurally valid
const _result: AssertionResult = { pass: true, score: 0.9, reasoning: "ok" };
const _preflightConfig: PreflightCheckConfig = {
  apiKey: "test",
  projectSlug: "test",
};
void _result;
void _preflightConfig;
