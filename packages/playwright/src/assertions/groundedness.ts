import { JudgeClient, type JudgeEvaluator } from "../judge/client.js";
import { GROUNDEDNESS_SYSTEM, GROUNDEDNESS_USER } from "../judge/prompts.js";
import type { AssertionResult, JudgeConfig } from "../types.js";

/**
 * Evaluate whether an LLM response is factually grounded in the source context.
 * Catches hallucinations by checking every claim against the provided context.
 */
export async function evaluateGroundedness(
  input: string,
  context: string,
  config?: JudgeConfig,
  client?: JudgeEvaluator,
): Promise<
  AssertionResult & { model: string; latencyMs: number; fallbackUsed: boolean }
> {
  if (!input || input.trim().length === 0) {
    return {
      pass: false,
      score: 0,
      reasoning: "Empty input — nothing to evaluate.",
      model: "none",
      latencyMs: 0,
      fallbackUsed: false,
    };
  }

  const judge = client ?? new JudgeClient(config);
  const { response, model, latencyMs, fallbackUsed } = await judge.evaluate(
    GROUNDEDNESS_SYSTEM,
    GROUNDEDNESS_USER(context, input),
  );

  // Inconclusive — judge unavailable
  if (response.score === null) {
    return {
      pass: false,
      score: null,
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
