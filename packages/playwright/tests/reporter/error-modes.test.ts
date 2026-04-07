import { test, expect } from "@playwright/test";
import {
  createReporter,
  makeTestCase,
  makeTestResultWithEval,
  validEvalData,
} from "../helpers/mock-reporter.js";
import {
  mockFetch,
  restoreFetch,
  build429Response,
  getFetchCalls,
} from "../helpers/mock-fetch.js";

test.afterEach(() => {
  restoreFetch();
});

test.describe("Reporter error modes", () => {
  test("onError: throw raises an error", async () => {
    mockFetch([{ status: 500 }]);

    const reporter = createReporter({
      apiKey: "sk-test-mock",
      preflight: false,
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
      preflight: false,
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
      preflight: false,
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

test.describe("Reporter 429 quota exhaustion", () => {
  test("429 emits formatted quota message via console.error", async () => {
    mockFetch([build429Response()]);

    const errors: string[] = [];
    const origError = console.error;
    console.error = (...args: unknown[]) => errors.push(args.join(" "));

    const origWrite = process.stderr.write;
    process.stderr.write = () => true; // suppress structured log

    const reporter = createReporter({
      apiKey: "sk-test-mock",
      preflight: false,
      retries: 0,
    });
    reporter.begin();
    reporter.onTestEnd(
      makeTestCase("test"),
      makeTestResultWithEval(validEvalData),
    );
    await reporter.end();

    console.error = origError;
    process.stderr.write = origWrite;

    const quotaMsg = errors.find((e) => e.includes("Quota exceeded"));
    expect(quotaMsg).toBeDefined();
    expect(quotaMsg).toContain("100/100");
    expect(quotaMsg).toContain("free plan");
    expect(quotaMsg).toContain("2026");
    expect(quotaMsg).toContain("llmassert.com");
  });

  test("429 does not retry", async () => {
    mockFetch([build429Response()]);

    const origError = console.error;
    console.error = () => {};
    const origWrite = process.stderr.write;
    process.stderr.write = () => true;

    const reporter = createReporter({
      apiKey: "sk-test-mock",
      preflight: false,
      retries: 3,
    });
    reporter.begin();
    reporter.onTestEnd(
      makeTestCase("test"),
      makeTestResultWithEval(validEvalData),
    );
    await reporter.end();

    console.error = origError;
    process.stderr.write = origWrite;

    // Should only be called once (no retries for 429)
    expect(getFetchCalls()).toHaveLength(1);
  });

  test("onQuotaExhausted: fail throws error on 429", async () => {
    mockFetch([build429Response()]);

    const origWrite = process.stderr.write;
    process.stderr.write = () => true;

    const reporter = createReporter({
      apiKey: "sk-test-mock",
      preflight: false,
      retries: 0,
      onQuotaExhausted: "fail",
    });
    reporter.begin();
    reporter.onTestEnd(
      makeTestCase("test"),
      makeTestResultWithEval(validEvalData),
    );

    await expect(reporter.end()).rejects.toThrow("Quota exceeded");

    process.stderr.write = origWrite;
  });

  test("429 with malformed body falls back to generic message", async () => {
    mockFetch([{ status: 429, body: "not json" }]);

    const errors: string[] = [];
    const origError = console.error;
    console.error = (...args: unknown[]) => errors.push(args.join(" "));
    const origWrite = process.stderr.write;
    process.stderr.write = () => true;

    const reporter = createReporter({
      apiKey: "sk-test-mock",
      preflight: false,
      retries: 0,
    });
    reporter.begin();
    reporter.onTestEnd(
      makeTestCase("test"),
      makeTestResultWithEval(validEvalData),
    );
    await reporter.end();

    console.error = origError;
    process.stderr.write = origWrite;

    const quotaMsg = errors.find((e) => e.includes("Quota exceeded"));
    expect(quotaMsg).toBeDefined();
    expect(quotaMsg).toContain("?/?"); // fallback unknown values
  });
});
