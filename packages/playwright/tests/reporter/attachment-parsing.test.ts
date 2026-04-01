import { test, expect } from "@playwright/test";
import {
  createReporter,
  makeTestCase,
  makeTestResult,
  makeTestResultWithEval,
  validEvalData,
} from "../helpers/mock-reporter.js";

test.describe("Reporter attachment parsing", () => {
  test("collects valid attachment", () => {
    const reporter = createReporter();
    reporter.begin();
    reporter.onTestEnd(
      makeTestCase("my test", "test.ts"),
      makeTestResultWithEval(validEvalData),
    );
    const evals = reporter.getEvaluations();
    expect(evals).toHaveLength(1);
    expect(evals[0].testName).toBe("my test");
    expect(evals[0].testFile).toBe("test.ts");
    expect(evals[0].score).toBe(0.85);
  });

  test("skips attachment with invalid JSON", () => {
    const reporter = createReporter({ onError: "silent" });
    reporter.begin();
    reporter.onTestEnd(
      makeTestCase("test"),
      makeTestResultWithEval("not json {{{"),
    );
    expect(reporter.getEvaluations()).toHaveLength(0);
  });

  test("skips attachment with missing required fields", () => {
    const reporter = createReporter({ onError: "silent" });
    reporter.begin();
    reporter.onTestEnd(
      makeTestCase("test"),
      makeTestResultWithEval({ score: 0.5 }),
    );
    expect(reporter.getEvaluations()).toHaveLength(0);
  });

  test("skips attachment with wrong name", () => {
    const reporter = createReporter();
    reporter.begin();
    reporter.onTestEnd(
      makeTestCase("test"),
      makeTestResult([
        {
          name: "screenshot",
          contentType: "image/png",
          body: Buffer.from("fake"),
        },
      ]),
    );
    expect(reporter.getEvaluations()).toHaveLength(0);
  });

  test("skips attachment with score out of range", () => {
    const reporter = createReporter({ onError: "silent" });
    reporter.begin();
    reporter.onTestEnd(
      makeTestCase("test"),
      makeTestResultWithEval({ ...validEvalData, score: 1.5 }),
    );
    expect(reporter.getEvaluations()).toHaveLength(0);
  });

  test("emits console.error with onError: warn for invalid attachment", () => {
    const errors: string[] = [];
    const origError = console.error;
    console.error = (...args: unknown[]) => errors.push(args.join(" "));

    const reporter = createReporter({ onError: "warn" });
    reporter.begin();
    reporter.onTestEnd(
      makeTestCase("test"),
      makeTestResultWithEval("not valid json {{{"),
    );

    console.error = origError;
    expect(reporter.getEvaluations()).toHaveLength(0);
    expect(errors.some((e) => e.includes("[LLMAssert] Warning:"))).toBe(true);
  });

  test("accepts score of -1 (inconclusive)", () => {
    const reporter = createReporter();
    reporter.begin();
    reporter.onTestEnd(
      makeTestCase("test"),
      makeTestResultWithEval({
        ...validEvalData,
        score: -1,
        result: "inconclusive",
      }),
    );
    const evals = reporter.getEvaluations();
    expect(evals).toHaveLength(1);
    expect(evals[0].score).toBe(-1);
  });
});
