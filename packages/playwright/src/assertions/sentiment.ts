import { JudgeClient, type JudgeEvaluator } from "../judge/client.js";
import { SENTIMENT_SYSTEM, SENTIMENT_USER } from "../judge/prompts.js";
import type { AssertionResult, JudgeConfig } from "../types.js";

/**
 * Evaluate whether text matches a described tone/sentiment.
 * e.g., "professional", "empathetic", "not sarcastic"
 */
export async function evaluateSentiment(
  input: string,
  descriptor: string,
  config?: JudgeConfig,
  client?: JudgeEvaluator,
): Promise<
  AssertionResult & { model: string; latencyMs: number; fallbackUsed: boolean }
> {
  if (!input || input.trim().length === 0) {
    return {
      pass: false,
      score: 0,
      reasoning: "Empty input — cannot evaluate tone.",
      model: "none",
      latencyMs: 0,
      fallbackUsed: false,
    };
  }

  const judge = client ?? new JudgeClient(config);
  const { response, model, latencyMs, fallbackUsed } = await judge.evaluate(
    SENTIMENT_SYSTEM,
    SENTIMENT_USER(descriptor, input),
  );

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
