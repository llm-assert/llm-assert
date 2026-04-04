import { test, expect } from "@playwright/test";
import { calculateCostUsd, MODEL_PRICING } from "../../src/judge/pricing.js";

test.describe("calculateCostUsd", () => {
  test("returns computed cost for known model (gpt-5.4-mini)", () => {
    const cost = calculateCostUsd("gpt-5.4-mini", {
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
    });
    expect(cost).not.toBeNull();
    // $0.15 input + $0.60 output = $0.75 per 1M tokens each
    expect(cost).toBeCloseTo(0.75, 2);
  });

  test("returns computed cost for known model (claude-3-5-haiku)", () => {
    const cost = calculateCostUsd("claude-3-5-haiku-20241022", {
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
    });
    expect(cost).not.toBeNull();
    // $0.80 input + $4.00 output = $4.80 per 1M tokens each
    expect(cost).toBeCloseTo(4.8, 2);
  });

  test("returns null for unknown model", () => {
    const cost = calculateCostUsd("unknown-model-v99", {
      inputTokens: 500,
      outputTokens: 100,
    });
    expect(cost).toBeNull();
  });

  test("returns zero cost for zero tokens", () => {
    const cost = calculateCostUsd("gpt-5.4-mini", {
      inputTokens: 0,
      outputTokens: 0,
    });
    expect(cost).toBe(0);
  });

  test("custom pricing overrides built-in rate", () => {
    const customPricing = {
      "gpt-5.4-mini": {
        inputPerToken: 0.001,
        outputPerToken: 0.002,
      },
    };
    const cost = calculateCostUsd(
      "gpt-5.4-mini",
      { inputTokens: 100, outputTokens: 50 },
      customPricing,
    );
    expect(cost).toBeCloseTo(0.1 + 0.1, 5); // 100*0.001 + 50*0.002
  });

  test("custom pricing adds new model", () => {
    const customPricing = {
      "custom-model": {
        inputPerToken: 0.0005,
        outputPerToken: 0.001,
      },
    };
    const cost = calculateCostUsd(
      "custom-model",
      { inputTokens: 200, outputTokens: 100 },
      customPricing,
    );
    expect(cost).toBeCloseTo(0.1 + 0.1, 5); // 200*0.0005 + 100*0.001
  });

  test("custom pricing preserves built-in models", () => {
    const customPricing = {
      "custom-model": {
        inputPerToken: 0.001,
        outputPerToken: 0.002,
      },
    };
    const cost = calculateCostUsd(
      "gpt-5.4-mini",
      { inputTokens: 1000, outputTokens: 1000 },
      customPricing,
    );
    expect(cost).not.toBeNull();
    // Should use built-in gpt-5.4-mini rate, not null
    const rates = MODEL_PRICING["gpt-5.4-mini"];
    const expected = 1000 * rates.inputPerToken + 1000 * rates.outputPerToken;
    expect(cost).toBeCloseTo(expected, 10);
  });
});
