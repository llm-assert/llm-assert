import {
  JudgeClient,
  type JudgeEvaluator,
  DEFAULT_CONFIG,
} from "../judge/client.js";
import { SCHEMA_SYSTEM, SCHEMA_USER } from "../judge/prompts.js";
import {
  stripControlSequences,
  validateInputLength,
} from "../judge/sanitize.js";
import { log } from "../logger.js";
import type { HardenedResult, JudgeConfig } from "../types.js";

/**
 * Evaluate whether text conforms to a described structural format.
 * e.g., JSON schema, bullet list, numbered steps
 */
export async function evaluateSchema(
  input: string,
  schema: string,
  config?: JudgeConfig,
  client?: JudgeEvaluator,
  threshold = 0.7,
): Promise<HardenedResult> {
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

  const maxChars = config?.maxInputChars ?? DEFAULT_CONFIG.maxInputChars;
  const handling = config?.inputHandling ?? DEFAULT_CONFIG.inputHandling;

  const lengthCheck = validateInputLength([input, schema], maxChars, handling);
  if (!lengthCheck.valid) {
    log("warn", "input.rejected.too_long", {
      assertionType: "schema",
      inputLengthChars: input.length + schema.length,
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
  let processedSchema = lengthCheck.texts[1];
  const inputSan = stripControlSequences(processedInput);
  const schemaSan = stripControlSequences(processedSchema);
  processedInput = inputSan.text;
  processedSchema = schemaSan.text;
  const injectionDetected = inputSan.stripped || schemaSan.stripped;

  if (injectionDetected) {
    log("warn", "input.rejected.injection_suspected", {
      assertionType: "schema",
    });
  }

  const judge = client ?? new JudgeClient(config);
  const {
    response,
    model,
    latencyMs,
    fallbackUsed,
    failureReason,
    backoffMs,
    usage,
    costUsd,
  } = await judge.evaluate(
    SCHEMA_SYSTEM,
    SCHEMA_USER(processedSchema, processedInput),
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
      judgeInputTokens: usage?.inputTokens,
      judgeOutputTokens: usage?.outputTokens,
      judgeCostUsd: costUsd,
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
    judgeInputTokens: usage?.inputTokens,
    judgeOutputTokens: usage?.outputTokens,
    judgeCostUsd: costUsd,
  };
}
