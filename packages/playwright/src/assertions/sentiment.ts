import { JudgeClient } from "../judge/client.js";
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
  client?: JudgeClient,
): Promise<AssertionResult & { model: string; latencyMs: number }> {
  if (!input || input.trim().length === 0) {
    return {
      pass: false,
      score: 0,
      reasoning: "Empty input — cannot evaluate tone.",
      model: "none",
      latencyMs: 0,
    };
  }

  const judge = client ?? new JudgeClient(config);
  const { response, model, latencyMs } = await judge.evaluate(
    SENTIMENT_SYSTEM,
    SENTIMENT_USER(descriptor, input),
  );

  if (response.score === -1) {
    return {
      pass: false,
      score: -1,
      reasoning: response.reasoning,
      model,
      latencyMs,
    };
  }

  return {
    pass: response.score >= 0.7,
    score: response.score,
    reasoning: response.reasoning,
    model,
    latencyMs,
  };
}
