import { expect as baseExpect, test as baseTest } from "@playwright/test";
import { evaluateGroundedness } from "./assertions/groundedness.js";
import { evaluatePII } from "./assertions/pii.js";
import { evaluateSentiment } from "./assertions/sentiment.js";
import { evaluateSchema } from "./assertions/schema.js";
import { evaluateFuzzy } from "./assertions/fuzzy.js";
import type { JudgeConfig } from "./types.js";

export type {
  AssertionResult,
  JudgeConfig,
  ReporterConfig,
  EvaluationRecord,
} from "./types.js";
export { JudgeClient } from "./judge/client.js";

/** Extended expect with LLMAssert matchers */
export const expect = baseExpect.extend({
  async toBeGroundedIn(
    input: string,
    context: string,
    options?: { threshold?: number; config?: JudgeConfig },
  ) {
    const result = await evaluateGroundedness(input, context, options?.config);
    const threshold = options?.threshold ?? 0.7;
    const pass = result.score >= threshold && result.score !== -1;

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
    const result = await evaluatePII(input, options?.config);
    const threshold = options?.threshold ?? 0.7;
    const pass = result.score >= threshold && result.score !== -1;

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
    const result = await evaluateSentiment(input, descriptor, options?.config);
    const threshold = options?.threshold ?? 0.7;
    const pass = result.score >= threshold && result.score !== -1;

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
    const result = await evaluateSchema(input, schema, options?.config);
    const threshold = options?.threshold ?? 0.7;
    const pass = result.score >= threshold && result.score !== -1;

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
    const result = await evaluateFuzzy(
      input,
      expected,
      threshold,
      options?.config,
    );
    const pass = result.score >= threshold && result.score !== -1;

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

/** Re-export test for convenience */
export { baseTest as test };

/** TypeScript augmentation for custom matchers */
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
