import { test, expect } from "@playwright/test";
import { evaluateSchema } from "../../src/assertions/schema.js";
import {
  createMockJudge,
  mockPassingJudge,
  mockFailingJudge,
  mockInconclusiveJudge,
} from "../helpers/mock-judge.js";

test.describe("evaluateSchema", () => {
  test("passes when format is compliant", async () => {
    const result = await evaluateSchema(
      '{"name": "test", "value": 42}',
      "JSON object with name and value fields",
      undefined,
      mockPassingJudge(),
    );
    expect(result.pass).toBe(true);
    expect(result.score).toBe(0.9);
  });

  test("fails when format is non-compliant", async () => {
    const result = await evaluateSchema(
      "just plain text",
      "JSON object with name and value fields",
      undefined,
      mockFailingJudge(),
    );
    expect(result.pass).toBe(false);
    expect(result.score).toBe(0.2);
  });

  test("returns fail with score 0 for empty input", async () => {
    const result = await evaluateSchema("", "some schema");
    expect(result.pass).toBe(false);
    expect(result.score).toBe(0);
    expect(result.model).toBe("none");
  });

  test("returns fail for inconclusive (score null)", async () => {
    const result = await evaluateSchema(
      "text",
      "JSON",
      undefined,
      mockInconclusiveJudge(),
    );
    expect(result.pass).toBe(false);
    expect(result.score).toBeNull();
  });

  test("propagates response fields from judge", async () => {
    const judge = createMockJudge({
      score: 0.95,
      reasoning: "Perfect format match",
      model: "schema-model",
      latencyMs: 20,
    });
    const result = await evaluateSchema("{}", "JSON object", undefined, judge);
    expect(result.reasoning).toBe("Perfect format match");
    expect(result.model).toBe("schema-model");
  });
});
