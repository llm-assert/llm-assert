import { test, expect } from "@playwright/test";
import {
  createReporter,
  makeTestCase,
  makeTestResultWithEval,
  validEvalData,
} from "../helpers/mock-reporter.js";
import { mockFetch, restoreFetch } from "../helpers/mock-fetch.js";

test.afterEach(() => {
  restoreFetch();
});

test.describe("Reporter error modes", () => {
  test("onError: throw raises an error", async () => {
    mockFetch([{ status: 500 }]);

    const reporter = createReporter({
      apiKey: "sk-test-mock",
      retries: 0,
      onError: "throw",
    });
    reporter.begin();
    reporter.onTestEnd(
      makeTestCase("test"),
      makeTestResultWithEval(validEvalData),
    );

    await expect(reporter.end()).rejects.toThrow("[LLMAssert]");
  });

  test("onError: warn calls console.error", async () => {
    mockFetch([{ status: 500 }]);

    const errors: string[] = [];
    const origError = console.error;
    console.error = (...args: unknown[]) => errors.push(args.join(" "));

    const reporter = createReporter({
      apiKey: "sk-test-mock",
      retries: 0,
      onError: "warn",
    });
    reporter.begin();
    reporter.onTestEnd(
      makeTestCase("test"),
      makeTestResultWithEval(validEvalData),
    );
    await reporter.end();

    console.error = origError;
    expect(errors.some((e) => e.includes("[LLMAssert] Warning:"))).toBe(true);
  });

  test("onError: silent produces no output", async () => {
    mockFetch([{ status: 500 }]);

    const errors: string[] = [];
    const origError = console.error;
    console.error = (...args: unknown[]) => errors.push(args.join(" "));

    const reporter = createReporter({
      apiKey: "sk-test-mock",
      retries: 0,
      onError: "silent",
    });
    reporter.begin();
    reporter.onTestEnd(
      makeTestCase("test"),
      makeTestResultWithEval(validEvalData),
    );
    await reporter.end();

    console.error = origError;
    expect(errors.filter((e) => e.includes("[LLMAssert]"))).toHaveLength(0);
  });
});
