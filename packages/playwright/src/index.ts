import { expect as baseExpect, test as baseTest } from "@playwright/test";
import { evaluateGroundedness } from "./assertions/groundedness.js";
import { evaluatePII } from "./assertions/pii.js";
import { evaluateSentiment } from "./assertions/sentiment.js";
import { evaluateSchema } from "./assertions/schema.js";
import { evaluateFuzzy } from "./assertions/fuzzy.js";
import { getWorkerJudgeClient } from "./singleton.js";
import type {
  EvaluationRecord,
  EvaluationResult,
  JudgeConfig,
} from "./types.js";

export type {
  AssertionResult,
  JudgeConfig,
  ReporterConfig,
  EvaluationRecord,
  LLMAssertFixture,
  LLMAssertOptions,
} from "./types.js";
export { JudgeClient, type JudgeEvaluator } from "./judge/client.js";

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
    const threshold = options?.threshold ?? 0.7;
    const pass = result.score !== null && result.score >= threshold;

    await attachEvaluation({
      assertionType: "groundedness",
      inputText: input,
      contextText: context,
      expectedValue: `score >= ${threshold}`,
      threshold,
      result: mapResult(result.score, pass),
      score: result.score,
      reasoning: result.reasoning,
      judgeModel: result.model,
      judgeLatencyMs: result.latencyMs,
      fallbackUsed: result.fallbackUsed,
    });

    return {
      pass,
      message: () =>
        `Expected output ${this.isNot ? "not " : ""}to be grounded in context\n` +
        `Score: ${result.score}\n` +
        `Reasoning: ${result.reasoning}\n` +
        `Judge: ${result.model} (${result.latencyMs}ms)`,
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
    const threshold = options?.threshold ?? 0.7;
    const pass = result.score !== null && result.score >= threshold;

    await attachEvaluation({
      assertionType: "pii",
      inputText: input,
      expectedValue: `score >= ${threshold}`,
      threshold,
      result: mapResult(result.score, pass),
      score: result.score,
      reasoning: result.reasoning,
      judgeModel: result.model,
      judgeLatencyMs: result.latencyMs,
      fallbackUsed: result.fallbackUsed,
    });

    return {
      pass,
      message: () =>
        `Expected output ${this.isNot ? "not " : ""}to be free of PII\n` +
        `Score: ${result.score}\n` +
        `Reasoning: ${result.reasoning}\n` +
        `Judge: ${result.model} (${result.latencyMs}ms)`,
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
    const threshold = options?.threshold ?? 0.7;
    const pass = result.score !== null && result.score >= threshold;

    await attachEvaluation({
      assertionType: "sentiment",
      inputText: input,
      expectedValue: descriptor,
      threshold,
      result: mapResult(result.score, pass),
      score: result.score,
      reasoning: result.reasoning,
      judgeModel: result.model,
      judgeLatencyMs: result.latencyMs,
      fallbackUsed: result.fallbackUsed,
    });

    return {
      pass,
      message: () =>
        `Expected output ${this.isNot ? "not " : ""}to match tone "${descriptor}"\n` +
        `Score: ${result.score}\n` +
        `Reasoning: ${result.reasoning}\n` +
        `Judge: ${result.model} (${result.latencyMs}ms)`,
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
    const threshold = options?.threshold ?? 0.7;
    const pass = result.score !== null && result.score >= threshold;

    await attachEvaluation({
      assertionType: "schema",
      inputText: input,
      expectedValue: schema,
      threshold,
      result: mapResult(result.score, pass),
      score: result.score,
      reasoning: result.reasoning,
      judgeModel: result.model,
      judgeLatencyMs: result.latencyMs,
      fallbackUsed: result.fallbackUsed,
    });

    return {
      pass,
      message: () =>
        `Expected output ${this.isNot ? "not " : ""}to comply with format\n` +
        `Score: ${result.score}\n` +
        `Reasoning: ${result.reasoning}\n` +
        `Judge: ${result.model} (${result.latencyMs}ms)`,
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
    const threshold = options?.threshold ?? 0.7;
    const client = options?.config
      ? undefined
      : (getWorkerJudgeClient() ?? undefined);
    const result = await evaluateFuzzy(
      input,
      expected,
      threshold,
      options?.config,
      client,
    );
    const pass = result.score !== null && result.score >= threshold;

    await attachEvaluation({
      assertionType: "fuzzy",
      inputText: input,
      expectedValue: expected,
      threshold,
      result: mapResult(result.score, pass),
      score: result.score,
      reasoning: result.reasoning,
      judgeModel: result.model,
      judgeLatencyMs: result.latencyMs,
      fallbackUsed: result.fallbackUsed,
    });

    return {
      pass,
      message: () =>
        `Expected output ${this.isNot ? "not " : ""}to semantically match reference\n` +
        `Score: ${result.score}\n` +
        `Reasoning: ${result.reasoning}\n` +
        `Judge: ${result.model} (${result.latencyMs}ms)`,
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
