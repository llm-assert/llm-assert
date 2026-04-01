import { test, expect } from "@playwright/test";
import { evaluateFuzzy } from "../../src/assertions/fuzzy.js";
import {
  createMockJudge,
  mockPassingJudge,
  mockFailingJudge,
  mockInconclusiveJudge,
} from "../helpers/mock-judge.js";

test.describe("evaluateFuzzy", () => {
  test("passes when score is above threshold", async () => {
    const result = await evaluateFuzzy(
      "hello world",
      "hi world",
      0.7,
      undefined,
      mockPassingJudge(),
    );
    expect(result.pass).toBe(true);
    expect(result.score).toBe(0.9);
    expect(result.reasoning).toBe("Mock pass");
  });

  test("fails when score is below threshold", async () => {
    const result = await evaluateFuzzy(
      "hello",
      "goodbye",
      0.7,
      undefined,
      mockFailingJudge(),
    );
    expect(result.pass).toBe(false);
    expect(result.score).toBe(0.2);
  });

  test("returns fail with score 0 for empty input", async () => {
    const result = await evaluateFuzzy("", "reference", 0.7);
    expect(result.pass).toBe(false);
    expect(result.score).toBe(0);
    expect(result.model).toBe("none");
    expect(result.latencyMs).toBe(0);
  });

  test("returns fail for inconclusive (score null)", async () => {
    const result = await evaluateFuzzy(
      "hello",
      "hi",
      0.7,
      undefined,
      mockInconclusiveJudge(),
    );
    expect(result.pass).toBe(false);
    expect(result.score).toBeNull();
  });

  test("propagates model and latency from judge", async () => {
    const judge = createMockJudge({
      score: 0.85,
      reasoning: "Very similar",
      model: "custom-model",
      latencyMs: 42,
      fallbackUsed: true,
    });
    const result = await evaluateFuzzy("a", "b", 0.7, undefined, judge);
    expect(result.model).toBe("custom-model");
    expect(result.latencyMs).toBe(42);
    expect(result.fallbackUsed).toBe(true);
    expect(result.reasoning).toBe("Very similar");
  });
});
