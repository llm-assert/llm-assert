import { JudgeClient } from "../judge/client.js";
import { FUZZY_SYSTEM, FUZZY_USER } from "../judge/prompts.js";
import type { AssertionResult, JudgeConfig } from "../types.js";

/**
 * Evaluate semantic similarity between candidate and reference text.
 * Score 1.0 = identical meaning, 0.0 = completely unrelated.
 */
export async function evaluateFuzzy(
  input: string,
  expected: string,
  threshold: number = 0.7,
  config?: JudgeConfig,
  client?: JudgeClient,
): Promise<
  AssertionResult & { model: string; latencyMs: number; fallbackUsed: boolean }
> {
  if (!input || input.trim().length === 0) {
    return {
      pass: false,
      score: 0,
      reasoning: "Empty input — cannot evaluate similarity.",
      model: "none",
      latencyMs: 0,
      fallbackUsed: false,
    };
  }

  const judge = client ?? new JudgeClient(config);
  const { response, model, latencyMs, fallbackUsed } = await judge.evaluate(
    FUZZY_SYSTEM,
    FUZZY_USER(expected, input),
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
    pass: response.score >= threshold,
    score: response.score,
    reasoning: response.reasoning,
    model,
    latencyMs,
    fallbackUsed,
  };
}
