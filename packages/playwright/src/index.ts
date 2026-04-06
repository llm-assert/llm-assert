import { expect as baseExpect, test as baseTest } from "@playwright/test";
import { evaluateGroundedness } from "./assertions/groundedness.js";
import { evaluatePII } from "./assertions/pii.js";
import { evaluateSentiment } from "./assertions/sentiment.js";
import { evaluateSchema } from "./assertions/schema.js";
import { evaluateFuzzy } from "./assertions/fuzzy.js";
import { getWorkerJudgeClient } from "./singleton.js";
import { resolveThreshold } from "./threshold/client.js";
import type {
  EvaluationRecord,
  EvaluationResult,
  JudgeConfig,
} from "./types.js";

export type {
  AssertionResult,
  HardenedResult,
  JudgeConfig,
  JSONReporterConfig,
  ReporterConfig,
  EvaluationRecord,
  LLMAssertFixture,
  LLMAssertOptions,
  FailureReason,
  ThresholdSource,
  RemoteThresholds,
  TokenUsage,
} from "./types.js";
export { calculateCostUsd } from "./judge/pricing.js";
export {
  JudgeClient,
  type JudgeEvaluator,
  type Clock,
} from "./judge/client.js";

/** Attach evaluation data for the reporter to collect via result.attachments */
async function attachEvaluation(
  record: Omit<EvaluationRecord, "testName" | "testFile">,
): Promise<void> {
  try {
    await baseTest.info().attach("llmassert-eval", {
      body: JSON.stringify(record),
      contentType: "application/json",
    });
  } catch {
    // Outside test context — skip attachment silently.
    // Evaluation still runs; only dashboard reporting is affected.
  }
}

/** Map judge score to explicit result enum */
function mapResult(score: number | null, pass: boolean): EvaluationResult {
  return score === null ? "inconclusive" : pass ? "pass" : "fail";
}

/** Format message, prefixing operational rejections with [LLMAssert] */
function formatMessage(
  reasoning: string,
  score: number | null,
  model: string,
  latencyMs: number,
  baseMessage: string,
  rateLimited?: boolean,
  backoffMs?: number,
): string {
  // Operational rejection — reasoning starts with [LLMAssert]
  if (reasoning.startsWith("[LLMAssert]")) {
    return reasoning;
  }
  let msg =
    `${baseMessage}\n` +
    `Score: ${score}\n` +
    `Reasoning: ${reasoning}\n` +
    `Judge: ${model} (${latencyMs}ms)`;
  if (rateLimited && backoffMs) {
    msg += `\n[LLMAssert] Evaluation was rate limited (+${backoffMs}ms backoff)`;
  }
  return msg;
}

/** Extended expect with LLMAssert matchers */
export const expect = baseExpect.extend({
  async toBeGroundedIn(
    input: string,
    context: string,
    options?: { threshold?: number; config?: JudgeConfig },
  ) {
    const client = options?.config
      ? undefined
      : (getWorkerJudgeClient() ?? undefined);
    const result = await evaluateGroundedness(
      input,
      context,
      options?.config,
      client,
    );
    const resolved = resolveThreshold("groundedness", options?.threshold);
    const threshold = resolved.value;
    const pass = result.score !== null && result.score >= threshold;

    await attachEvaluation({
      assertionType: "groundedness",
      inputText: input,
      contextText: context,
      expectedValue: `score >= ${threshold}`,
      threshold,
      thresholdSource: resolved.source,
      result: mapResult(result.score, pass),
      score: result.score,
      reasoning: result.reasoning,
      judgeModel: result.model,
      judgeLatencyMs: result.latencyMs,
      fallbackUsed: result.fallbackUsed,
      inputTruncated: result.inputTruncated,
      injectionDetected: result.injectionDetected,
      rateLimited: result.rateLimited,
      judgeBackoffMs: result.judgeBackoffMs,
      failureReason: result.failureReason,
      judgeInputTokens: result.judgeInputTokens,
      judgeOutputTokens: result.judgeOutputTokens,
      judgeCostUsd: result.judgeCostUsd,
    });

    return {
      pass,
      message: () =>
        formatMessage(
          result.reasoning,
          result.score,
          result.model,
          result.latencyMs,
          `Expected output ${this.isNot ? "not " : ""}to be grounded in context`,
          result.rateLimited,
          result.judgeBackoffMs,
        ),
      name: "toBeGroundedIn",
      expected: `score >= ${threshold}`,
      actual: result.score,
    };
  },

  async toBeFreeOfPII(
    input: string,
    options?: { threshold?: number; config?: JudgeConfig },
  ) {
    const client = options?.config
      ? undefined
      : (getWorkerJudgeClient() ?? undefined);
    const result = await evaluatePII(input, options?.config, client);
    const resolved = resolveThreshold("pii", options?.threshold);
    const threshold = resolved.value;
    const pass = result.score !== null && result.score >= threshold;

    await attachEvaluation({
      assertionType: "pii",
      inputText: input,
      expectedValue: `score >= ${threshold}`,
      threshold,
      thresholdSource: resolved.source,
      result: mapResult(result.score, pass),
      score: result.score,
      reasoning: result.reasoning,
      judgeModel: result.model,
      judgeLatencyMs: result.latencyMs,
      fallbackUsed: result.fallbackUsed,
      inputTruncated: result.inputTruncated,
      injectionDetected: result.injectionDetected,
      rateLimited: result.rateLimited,
      judgeBackoffMs: result.judgeBackoffMs,
      failureReason: result.failureReason,
      judgeInputTokens: result.judgeInputTokens,
      judgeOutputTokens: result.judgeOutputTokens,
      judgeCostUsd: result.judgeCostUsd,
    });

    return {
      pass,
      message: () =>
        formatMessage(
          result.reasoning,
          result.score,
          result.model,
          result.latencyMs,
          `Expected output ${this.isNot ? "not " : ""}to be free of PII`,
          result.rateLimited,
          result.judgeBackoffMs,
        ),
      name: "toBeFreeOfPII",
      expected: `score >= ${threshold}`,
      actual: result.score,
    };
  },

  async toMatchTone(
    input: string,
    descriptor: string,
    options?: { threshold?: number; config?: JudgeConfig },
  ) {
    const client = options?.config
      ? undefined
      : (getWorkerJudgeClient() ?? undefined);
    const result = await evaluateSentiment(
      input,
      descriptor,
      options?.config,
      client,
    );
    const resolved = resolveThreshold("sentiment", options?.threshold);
    const threshold = resolved.value;
    const pass = result.score !== null && result.score >= threshold;

    await attachEvaluation({
      assertionType: "sentiment",
      inputText: input,
      expectedValue: descriptor,
      threshold,
      thresholdSource: resolved.source,
      result: mapResult(result.score, pass),
      score: result.score,
      reasoning: result.reasoning,
      judgeModel: result.model,
      judgeLatencyMs: result.latencyMs,
      fallbackUsed: result.fallbackUsed,
      inputTruncated: result.inputTruncated,
      injectionDetected: result.injectionDetected,
      rateLimited: result.rateLimited,
      judgeBackoffMs: result.judgeBackoffMs,
      failureReason: result.failureReason,
      judgeInputTokens: result.judgeInputTokens,
      judgeOutputTokens: result.judgeOutputTokens,
      judgeCostUsd: result.judgeCostUsd,
    });

    return {
      pass,
      message: () =>
        formatMessage(
          result.reasoning,
          result.score,
          result.model,
          result.latencyMs,
          `Expected output ${this.isNot ? "not " : ""}to match tone "${descriptor}"`,
          result.rateLimited,
          result.judgeBackoffMs,
        ),
      name: "toMatchTone",
      expected: `score >= ${threshold}`,
      actual: result.score,
    };
  },

  async toBeFormatCompliant(
    input: string,
    schema: string,
    options?: { threshold?: number; config?: JudgeConfig },
  ) {
    const client = options?.config
      ? undefined
      : (getWorkerJudgeClient() ?? undefined);
    const result = await evaluateSchema(input, schema, options?.config, client);
    const resolved = resolveThreshold("schema", options?.threshold);
    const threshold = resolved.value;
    const pass = result.score !== null && result.score >= threshold;

    await attachEvaluation({
      assertionType: "schema",
      inputText: input,
      expectedValue: schema,
      threshold,
      thresholdSource: resolved.source,
      result: mapResult(result.score, pass),
      score: result.score,
      reasoning: result.reasoning,
      judgeModel: result.model,
      judgeLatencyMs: result.latencyMs,
      fallbackUsed: result.fallbackUsed,
      inputTruncated: result.inputTruncated,
      injectionDetected: result.injectionDetected,
      rateLimited: result.rateLimited,
      judgeBackoffMs: result.judgeBackoffMs,
      failureReason: result.failureReason,
      judgeInputTokens: result.judgeInputTokens,
      judgeOutputTokens: result.judgeOutputTokens,
      judgeCostUsd: result.judgeCostUsd,
    });

    return {
      pass,
      message: () =>
        formatMessage(
          result.reasoning,
          result.score,
          result.model,
          result.latencyMs,
          `Expected output ${this.isNot ? "not " : ""}to comply with format`,
          result.rateLimited,
          result.judgeBackoffMs,
        ),
      name: "toBeFormatCompliant",
      expected: `score >= ${threshold}`,
      actual: result.score,
    };
  },

  async toSemanticMatch(
    input: string,
    expected: string,
    options?: { threshold?: number; config?: JudgeConfig },
  ) {
    const resolved = resolveThreshold("fuzzy", options?.threshold);
    const threshold = resolved.value;
    const client = options?.config
      ? undefined
      : (getWorkerJudgeClient() ?? undefined);
    const result = await evaluateFuzzy(
      input,
      expected,
      options?.config,
      client,
      threshold,
    );
    const pass = result.score !== null && result.score >= threshold;

    await attachEvaluation({
      assertionType: "fuzzy",
      inputText: input,
      expectedValue: expected,
      threshold,
      thresholdSource: resolved.source,
      result: mapResult(result.score, pass),
      score: result.score,
      reasoning: result.reasoning,
      judgeModel: result.model,
      judgeLatencyMs: result.latencyMs,
      fallbackUsed: result.fallbackUsed,
      inputTruncated: result.inputTruncated,
      injectionDetected: result.injectionDetected,
      rateLimited: result.rateLimited,
      judgeBackoffMs: result.judgeBackoffMs,
      failureReason: result.failureReason,
      judgeInputTokens: result.judgeInputTokens,
      judgeOutputTokens: result.judgeOutputTokens,
      judgeCostUsd: result.judgeCostUsd,
    });

    return {
      pass,
      message: () =>
        formatMessage(
          result.reasoning,
          result.score,
          result.model,
          result.latencyMs,
          `Expected output ${this.isNot ? "not " : ""}to semantically match reference`,
          result.rateLimited,
          result.judgeBackoffMs,
        ),
      name: "toSemanticMatch",
      expected: `score >= ${threshold}`,
      actual: result.score,
    };
  },
});

/** Re-export fixture-extended test */
export { test } from "./fixtures.js";

/** TypeScript augmentation for custom matchers and worker options */
declare module "@playwright/test" {
  interface Matchers<R> {
    toBeGroundedIn(
      context: string,
      options?: { threshold?: number; config?: JudgeConfig },
    ): Promise<R>;
    toBeFreeOfPII(options?: {
      threshold?: number;
      config?: JudgeConfig;
    }): Promise<R>;
    toMatchTone(
      descriptor: string,
      options?: { threshold?: number; config?: JudgeConfig },
    ): Promise<R>;
    toBeFormatCompliant(
      schema: string,
      options?: { threshold?: number; config?: JudgeConfig },
    ): Promise<R>;
    toSemanticMatch(
      expected: string,
      options?: { threshold?: number; config?: JudgeConfig },
    ): Promise<R>;
  }
}
