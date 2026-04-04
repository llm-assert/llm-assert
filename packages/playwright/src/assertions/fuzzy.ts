import {
  JudgeClient,
  type JudgeEvaluator,
  DEFAULT_CONFIG,
} from "../judge/client.js";
import { FUZZY_SYSTEM, FUZZY_USER } from "../judge/prompts.js";
import {
  stripControlSequences,
  validateInputLength,
} from "../judge/sanitize.js";
import { log } from "../logger.js";
import type { HardenedResult, JudgeConfig } from "../types.js";

/**
 * Evaluate semantic similarity between candidate and reference text.
 * Score 1.0 = identical meaning, 0.0 = completely unrelated.
 */
export async function evaluateFuzzy(
  input: string,
  expected: string,
  config?: JudgeConfig,
  client?: JudgeEvaluator,
  threshold = 0.7,
): Promise<HardenedResult> {
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

  const maxChars = config?.maxInputChars ?? DEFAULT_CONFIG.maxInputChars;
  const handling = config?.inputHandling ?? DEFAULT_CONFIG.inputHandling;

  const lengthCheck = validateInputLength(
    [input, expected],
    maxChars,
    handling,
  );
  if (!lengthCheck.valid) {
    log("warn", "input.rejected.too_long", {
      assertionType: "fuzzy",
      inputLengthChars: input.length + expected.length,
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
  let processedExpected = lengthCheck.texts[1];
  const inputSan = stripControlSequences(processedInput);
  const expectedSan = stripControlSequences(processedExpected);
  processedInput = inputSan.text;
  processedExpected = expectedSan.text;
  const injectionDetected = inputSan.stripped || expectedSan.stripped;

  if (injectionDetected) {
    log("warn", "input.rejected.injection_suspected", {
      assertionType: "fuzzy",
    });
  }

  const judge = client ?? new JudgeClient(config);
  const { response, model, latencyMs, fallbackUsed, failureReason, backoffMs } =
    await judge.evaluate(
      FUZZY_SYSTEM,
      FUZZY_USER(processedExpected, processedInput),
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
