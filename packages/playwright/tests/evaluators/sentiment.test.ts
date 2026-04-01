import { test, expect } from "@playwright/test";
import { evaluateSentiment } from "../../src/assertions/sentiment.js";
import {
  createMockJudge,
  mockPassingJudge,
  mockFailingJudge,
  mockInconclusiveJudge,
} from "../helpers/mock-judge.js";

test.describe("evaluateSentiment", () => {
  test("passes when tone matches", async () => {
    const result = await evaluateSentiment(
      "Thank you for your patience",
      "professional",
      undefined,
      mockPassingJudge(),
    );
    expect(result.pass).toBe(true);
    expect(result.score).toBe(0.9);
  });

  test("fails when tone does not match", async () => {
    const result = await evaluateSentiment(
      "Whatever, figure it out yourself",
      "professional",
      undefined,
      mockFailingJudge(),
    );
    expect(result.pass).toBe(false);
    expect(result.score).toBe(0.2);
  });

  test("returns fail with score 0 for empty input", async () => {
    const result = await evaluateSentiment("", "professional");
    expect(result.pass).toBe(false);
    expect(result.score).toBe(0);
    expect(result.model).toBe("none");
  });

  test("returns fail for inconclusive (score -1)", async () => {
    const result = await evaluateSentiment(
      "text",
      "friendly",
      undefined,
      mockInconclusiveJudge(),
    );
    expect(result.pass).toBe(false);
    expect(result.score).toBe(-1);
  });

  test("propagates response fields from judge", async () => {
    const judge = createMockJudge({
      score: 0.8,
      reasoning: "Tone is empathetic",
      model: "tone-model",
      latencyMs: 30,
      fallbackUsed: true,
    });
    const result = await evaluateSentiment("kind words", "empathetic", undefined, judge);
    expect(result.reasoning).toBe("Tone is empathetic");
    expect(result.fallbackUsed).toBe(true);
  });
});
