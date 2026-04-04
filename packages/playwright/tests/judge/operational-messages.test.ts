import { test, expect } from "@playwright/test";
import { evaluateGroundedness } from "../../src/assertions/groundedness.js";
import { evaluatePII } from "../../src/assertions/pii.js";
import { evaluateFuzzy } from "../../src/assertions/fuzzy.js";
import { mockPassingJudge } from "../helpers/mock-judge.js";

test.describe("Operational rejection messages", () => {
  test("length rejection includes [LLMAssert] prefix", async () => {
    const result = await evaluateGroundedness(
      "a".repeat(600),
      "b".repeat(600),
      { maxInputChars: 1000 },
      mockPassingJudge(),
    );

    expect(result.reasoning).toMatch(/^\[LLMAssert\] Input rejected:/);
    expect(result.reasoning).toContain("1,200");
    expect(result.reasoning).toContain("1,000");
  });

  test("pii length rejection includes [LLMAssert] prefix", async () => {
    const result = await evaluatePII("a".repeat(200), { maxInputChars: 100 });
    expect(result.reasoning).toMatch(/^\[LLMAssert\] Input rejected:/);
  });

  test("fuzzy length rejection includes [LLMAssert] prefix", async () => {
    const result = await evaluateFuzzy(
      "a".repeat(600),
      "b".repeat(600),
      { maxInputChars: 1000 },
      mockPassingJudge(),
      0.7,
    );
    expect(result.reasoning).toMatch(/^\[LLMAssert\] Input rejected:/);
  });

  test("normal failure does NOT include [LLMAssert] prefix", async () => {
    const result = await evaluateGroundedness(
      "response",
      "context",
      undefined,
      mockPassingJudge(),
    );
    expect(result.reasoning).not.toContain("[LLMAssert]");
  });
});
