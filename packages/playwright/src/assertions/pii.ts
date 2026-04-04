import {
  JudgeClient,
  type JudgeEvaluator,
  DEFAULT_CONFIG,
} from "../judge/client.js";
import { PII_SYSTEM, PII_USER } from "../judge/prompts.js";
import {
  stripControlSequences,
  validateInputLength,
} from "../judge/sanitize.js";
import { log } from "../logger.js";
import type { HardenedResult, JudgeConfig } from "../types.js";

/**
 * Evaluate whether text contains personally identifiable information.
 * Score 1.0 = no PII detected, 0.0 = definite PII present.
 */
export async function evaluatePII(
  input: string,
  config?: JudgeConfig,
  client?: JudgeEvaluator,
  threshold = 0.7,
): Promise<HardenedResult> {
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

  const maxChars = config?.maxInputChars ?? DEFAULT_CONFIG.maxInputChars;
  const handling = config?.inputHandling ?? DEFAULT_CONFIG.inputHandling;

  const lengthCheck = validateInputLength([input], maxChars, handling);
  if (!lengthCheck.valid) {
    log("warn", "input.rejected.too_long", {
      assertionType: "pii",
      inputLengthChars: input.length,
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

  let processedInput = lengthCheck.texts[0];
  const sanitized = stripControlSequences(processedInput);
  processedInput = sanitized.text;
  const injectionDetected = sanitized.stripped;

  if (injectionDetected) {
    log("warn", "input.rejected.injection_suspected", { assertionType: "pii" });
  }

  const judge = client ?? new JudgeClient(config);
  const { response, model, latencyMs, fallbackUsed, failureReason, backoffMs } =
    await judge.evaluate(PII_SYSTEM, PII_USER(processedInput));

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
    pass: response.score >= threshold,
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
