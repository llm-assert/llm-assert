import type { TokenUsage } from "../types.js";

/** Per-token pricing rates in USD */
export interface ModelPricing {
  inputPerToken: number;
  outputPerToken: number;
}

/**
 * Built-in pricing for known judge models.
 * Rates are per-token in USD (not per 1K or per 1M).
 */
export const MODEL_PRICING: Record<string, ModelPricing> = {
  "gpt-5.4-mini": {
    inputPerToken: 0.15 / 1_000_000, // $0.15 per 1M input tokens
    outputPerToken: 0.6 / 1_000_000, // $0.60 per 1M output tokens
  },
  "claude-3-5-haiku-20241022": {
    inputPerToken: 0.8 / 1_000_000, // $0.80 per 1M input tokens
    outputPerToken: 4.0 / 1_000_000, // $4.00 per 1M output tokens
  },
};

/**
 * Calculate cost in USD from model name and token usage.
 * Returns null when the model is not found in the pricing table.
 */
export function calculateCostUsd(
  model: string,
  usage: TokenUsage,
  customPricing?: Record<string, ModelPricing>,
): number | null {
  const mergedPricing = customPricing
    ? { ...MODEL_PRICING, ...customPricing }
    : MODEL_PRICING;

  const rates = mergedPricing[model];
  if (!rates) return null;

  return (
    usage.inputTokens * rates.inputPerToken +
    usage.outputTokens * rates.outputPerToken
  );
}
