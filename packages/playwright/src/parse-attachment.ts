import type {
  AssertionType,
  EvaluationRecord,
  EvaluationResult,
  FailureReason,
} from "./types.js";

export const ATTACHMENT_NAME = "llmassert-eval";

export const VALID_ASSERTION_TYPES: AssertionType[] = [
  "groundedness",
  "pii",
  "sentiment",
  "schema",
  "fuzzy",
];

export const VALID_RESULTS: EvaluationResult[] = [
  "pass",
  "fail",
  "inconclusive",
];

export const VALID_FAILURE_REASONS: FailureReason[] = [
  "provider_error",
  "rate_limited",
  "timeout",
  "parse_error",
  null,
];

/** Parse and validate a JSON attachment body as a partial EvaluationRecord */
export function parseEvaluationAttachment(
  body: Buffer,
): Omit<EvaluationRecord, "testName" | "testFile"> | null {
  let data: unknown;
  try {
    data = JSON.parse(body.toString());
  } catch {
    return null;
  }

  if (typeof data !== "object" || data === null) return null;

  const d = data as Record<string, unknown>;

  // Validate required fields and types
  if (d.score !== null && typeof d.score !== "number") return null;
  if (d.score !== null && (d.score < 0 || d.score > 1)) return null;
  if (typeof d.reasoning !== "string" || d.reasoning.length === 0) return null;
  if (!VALID_ASSERTION_TYPES.includes(d.assertionType as AssertionType))
    return null;
  if (!VALID_RESULTS.includes(d.result as EvaluationResult)) return null;
  if (typeof d.judgeModel !== "string") return null;
  if (typeof d.judgeLatencyMs !== "number") return null;
  if (typeof d.threshold !== "number") return null;

  // Validate optional hardening fields
  if (d.inputTruncated !== undefined && typeof d.inputTruncated !== "boolean")
    return null;
  if (
    d.injectionDetected !== undefined &&
    typeof d.injectionDetected !== "boolean"
  )
    return null;
  if (d.rateLimited !== undefined && typeof d.rateLimited !== "boolean")
    return null;
  if (
    d.judgeBackoffMs !== undefined &&
    (typeof d.judgeBackoffMs !== "number" || d.judgeBackoffMs < 0)
  )
    return null;
  if (
    d.failureReason !== undefined &&
    !VALID_FAILURE_REASONS.includes(d.failureReason as FailureReason)
  )
    return null;

  // Validate optional token/cost fields (must be positive integers, matching DB CHECK > 0)
  if (
    d.judgeInputTokens !== undefined &&
    (typeof d.judgeInputTokens !== "number" ||
      !Number.isInteger(d.judgeInputTokens) ||
      d.judgeInputTokens <= 0)
  )
    return null;
  if (
    d.judgeOutputTokens !== undefined &&
    (typeof d.judgeOutputTokens !== "number" ||
      !Number.isInteger(d.judgeOutputTokens) ||
      d.judgeOutputTokens <= 0)
  )
    return null;
  if (
    d.judgeCostUsd !== undefined &&
    (typeof d.judgeCostUsd !== "number" || d.judgeCostUsd < 0)
  )
    return null;

  return {
    assertionType: d.assertionType as AssertionType,
    inputText: typeof d.inputText === "string" ? d.inputText : "",
    contextText: typeof d.contextText === "string" ? d.contextText : undefined,
    expectedValue:
      typeof d.expectedValue === "string" ? d.expectedValue : undefined,
    threshold: d.threshold as number,
    thresholdSource:
      typeof d.thresholdSource === "string" &&
      ["inline", "remote", "default"].includes(d.thresholdSource)
        ? (d.thresholdSource as EvaluationRecord["thresholdSource"])
        : undefined,
    result: d.result as EvaluationResult,
    score: d.score as number | null,
    reasoning: d.reasoning as string,
    judgeModel: d.judgeModel as string,
    judgeLatencyMs: d.judgeLatencyMs as number,
    judgeInputTokens:
      typeof d.judgeInputTokens === "number" ? d.judgeInputTokens : undefined,
    judgeOutputTokens:
      typeof d.judgeOutputTokens === "number" ? d.judgeOutputTokens : undefined,
    judgeCostUsd:
      typeof d.judgeCostUsd === "number" ? d.judgeCostUsd : undefined,
    fallbackUsed: typeof d.fallbackUsed === "boolean" ? d.fallbackUsed : false,
    inputTruncated:
      typeof d.inputTruncated === "boolean" ? d.inputTruncated : undefined,
    injectionDetected:
      typeof d.injectionDetected === "boolean"
        ? d.injectionDetected
        : undefined,
    rateLimited: typeof d.rateLimited === "boolean" ? d.rateLimited : undefined,
    judgeBackoffMs:
      typeof d.judgeBackoffMs === "number" ? d.judgeBackoffMs : undefined,
    failureReason: (d.failureReason as FailureReason) ?? undefined,
  };
}
