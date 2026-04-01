import { test, expect } from "@playwright/test";
import { evaluateGroundedness } from "../../src/assertions/groundedness.js";
import {
  createMockJudge,
  mockPassingJudge,
  mockFailingJudge,
  mockInconclusiveJudge,
} from "../helpers/mock-judge.js";

test.describe("evaluateGroundedness", () => {
  test("passes when score is above 0.7 threshold", async () => {
    const result = await evaluateGroundedness(
      "The sky is blue",
      "The sky appears blue due to Rayleigh scattering",
      undefined,
      mockPassingJudge(),
    );
    expect(result.pass).toBe(true);
    expect(result.score).toBe(0.9);
  });

  test("fails when score is below 0.7 threshold", async () => {
    const result = await evaluateGroundedness(
      "Hallucinated claim",
      "Context about something else",
      undefined,
      mockFailingJudge(),
    );
    expect(result.pass).toBe(false);
    expect(result.score).toBe(0.2);
  });

  test("returns fail with score 0 for empty input", async () => {
    const result = await evaluateGroundedness("", "some context");
    expect(result.pass).toBe(false);
    expect(result.score).toBe(0);
    expect(result.model).toBe("none");
  });

  test("returns fail for inconclusive (score null)", async () => {
    const result = await evaluateGroundedness(
      "text",
      "context",
      undefined,
      mockInconclusiveJudge(),
    );
    expect(result.pass).toBe(false);
    expect(result.score).toBeNull();
  });

  test("propagates response fields from judge", async () => {
    const judge = createMockJudge({
      score: 0.75,
      reasoning: "Mostly grounded",
      model: "test-model",
      latencyMs: 100,
      fallbackUsed: true,
    });
    const result = await evaluateGroundedness("a", "b", undefined, judge);
    expect(result.reasoning).toBe("Mostly grounded");
    expect(result.model).toBe("test-model");
    expect(result.fallbackUsed).toBe(true);
  });
});
