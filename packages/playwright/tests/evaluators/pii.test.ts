import { test, expect } from "@playwright/test";
import { evaluatePII } from "../../src/assertions/pii.js";
import {
  createMockJudge,
  mockPassingJudge,
  mockFailingJudge,
  mockInconclusiveJudge,
} from "../helpers/mock-judge.js";

test.describe("evaluatePII", () => {
  test("passes when score indicates no PII", async () => {
    const result = await evaluatePII(
      "The weather is nice today",
      undefined,
      mockPassingJudge(),
    );
    expect(result.pass).toBe(true);
    expect(result.score).toBe(0.9);
  });

  test("fails when score indicates PII present", async () => {
    const result = await evaluatePII(
      "Contact Jane at jane@example.com",
      undefined,
      mockFailingJudge(),
    );
    expect(result.pass).toBe(false);
    expect(result.score).toBe(0.2);
  });

  test("returns pass with score 1.0 for empty input (no PII possible)", async () => {
    const result = await evaluatePII("");
    expect(result.pass).toBe(true);
    expect(result.score).toBe(1.0);
    expect(result.model).toBe("none");
  });

  test("returns fail for inconclusive (score -1)", async () => {
    const result = await evaluatePII("text", undefined, mockInconclusiveJudge());
    expect(result.pass).toBe(false);
    expect(result.score).toBe(-1);
  });

  test("propagates response fields from judge", async () => {
    const judge = createMockJudge({
      score: 0.95,
      reasoning: "No PII detected",
      model: "pii-model",
      latencyMs: 50,
    });
    const result = await evaluatePII("clean text", undefined, judge);
    expect(result.reasoning).toBe("No PII detected");
    expect(result.model).toBe("pii-model");
  });
});
