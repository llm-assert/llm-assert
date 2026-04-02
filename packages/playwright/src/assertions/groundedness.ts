import { JudgeClient, type JudgeEvaluator } from "../judge/client.js";
import { GROUNDEDNESS_SYSTEM, GROUNDEDNESS_USER } from "../judge/prompts.js";
import {
  stripControlSequences,
  validateInputLength,
} from "../judge/sanitize.js";
import { log } from "../logger.js";
import type { HardenedResult, JudgeConfig } from "../types.js";
import { DEFAULT_CONFIG } from "../judge/client.js";

/**
 * Evaluate whether an LLM response is factually grounded in the source context.
 * Catches hallucinations by checking every claim against the provided context.
 */
export async function evaluateGroundedness(
  input: string,
  context: string,
  config?: JudgeConfig,
  client?: JudgeEvaluator,
): Promise<HardenedResult> {
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

  const maxChars = config?.maxInputChars ?? DEFAULT_CONFIG.maxInputChars;
  const handling = config?.inputHandling ?? DEFAULT_CONFIG.inputHandling;

  // Validate combined input length
  const lengthCheck = validateInputLength([input, context], maxChars, handling);
  if (!lengthCheck.valid) {
    log("warn", "input.rejected.too_long", {
      assertionType: "groundedness",
      inputLengthChars: input.length + context.length,
      maxChars,
    });
    return {
      pass: false,
      score: null,
      reasoning: `[LLMAssert] Input rejected: ${lengthCheck.reason}`,
      model: "none",
      latencyMs: 0,
      fallbackUsed: false,
      failureReason: null,
    };
  }

  // Apply sanitization
  let processedInput = lengthCheck.texts[0];
  let processedContext = lengthCheck.texts[1];
  let injectionDetected = false;

  const inputSanitized = stripControlSequences(processedInput);
  const contextSanitized = stripControlSequences(processedContext);
  processedInput = inputSanitized.text;
  processedContext = contextSanitized.text;
  injectionDetected = inputSanitized.stripped || contextSanitized.stripped;

  if (injectionDetected) {
    log("warn", "input.rejected.injection_suspected", {
      assertionType: "groundedness",
    });
  }

  const judge = client ?? new JudgeClient(config);
  const { response, model, latencyMs, fallbackUsed, failureReason, backoffMs } =
    await judge.evaluate(
      GROUNDEDNESS_SYSTEM,
      GROUNDEDNESS_USER(processedContext, processedInput),
    );

  if (response.score === null) {
    return {
      pass: false,
      score: null,
      reasoning: response.reasoning,
      model,
      latencyMs,
      fallbackUsed,
      inputTruncated: lengthCheck.truncated || undefined,
      injectionDetected: injectionDetected || undefined,
      rateLimited: backoffMs > 0 || undefined,
      judgeBackoffMs: backoffMs > 0 ? backoffMs : undefined,
      failureReason,
    };
  }

  return {
    pass: response.score >= 0.7,
    score: response.score,
    reasoning: response.reasoning,
    model,
    latencyMs,
    fallbackUsed,
    inputTruncated: lengthCheck.truncated || undefined,
    injectionDetected: injectionDetected || undefined,
    rateLimited: backoffMs > 0 || undefined,
    judgeBackoffMs: backoffMs > 0 ? backoffMs : undefined,
    failureReason,
  };
}
