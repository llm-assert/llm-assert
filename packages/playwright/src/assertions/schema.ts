import { JudgeClient, type JudgeEvaluator } from "../judge/client.js";
import { SCHEMA_SYSTEM, SCHEMA_USER } from "../judge/prompts.js";
import type { AssertionResult, JudgeConfig } from "../types.js";

/**
 * Evaluate whether text conforms to a described structural format.
 * e.g., JSON schema, bullet list, numbered steps
 */
export async function evaluateSchema(
  input: string,
  schema: string,
  config?: JudgeConfig,
  client?: JudgeEvaluator,
): Promise<
  AssertionResult & { model: string; latencyMs: number; fallbackUsed: boolean }
> {
  if (!input || input.trim().length === 0) {
    return {
      pass: false,
      score: 0,
      reasoning: "Empty input — cannot evaluate format compliance.",
      model: "none",
      latencyMs: 0,
      fallbackUsed: false,
    };
  }

  const judge = client ?? new JudgeClient(config);
  const { response, model, latencyMs, fallbackUsed } = await judge.evaluate(
    SCHEMA_SYSTEM,
    SCHEMA_USER(schema, input),
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
