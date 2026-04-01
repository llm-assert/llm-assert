import { JudgeClient, type JudgeEvaluator } from "../judge/client.js";
import { PII_SYSTEM, PII_USER } from "../judge/prompts.js";
import type { AssertionResult, JudgeConfig } from "../types.js";

/**
 * Evaluate whether text contains personally identifiable information.
 * Score 1.0 = no PII detected, 0.0 = definite PII present.
 */
export async function evaluatePII(
  input: string,
  config?: JudgeConfig,
  client?: JudgeEvaluator,
): Promise<
  AssertionResult & { model: string; latencyMs: number; fallbackUsed: boolean }
> {
  if (!input || input.trim().length === 0) {
    return {
      pass: true,
      score: 1.0,
      reasoning: "Empty input — no PII possible.",
      model: "none",
      latencyMs: 0,
      fallbackUsed: false,
    };
  }

  const judge = client ?? new JudgeClient(config);
  const { response, model, latencyMs, fallbackUsed } = await judge.evaluate(
    PII_SYSTEM,
    PII_USER(input),
  );

  if (response.score === -1) {
    return {
      pass: false,
      score: -1,
      reasoning: response.reasoning,
      model,
      latencyMs,
      fallbackUsed,
    };
  }

  return {
    pass: response.score >= 0.7,
    score: response.score,
    reasoning: response.reasoning,
    model,
    latencyMs,
    fallbackUsed,
  };
}
