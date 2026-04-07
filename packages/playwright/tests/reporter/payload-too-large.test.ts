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
  build413Response,
  getFetchCalls,
} from "../helpers/mock-fetch.js";

test.afterEach(() => {
  restoreFetch();
});

test.describe("Reporter 413 payload too large", () => {
  test("413 is not retried", async () => {
    mockFetch([build413Response()]);

    const errors: string[] = [];
    const origError = console.error;
    console.error = (...args: unknown[]) => errors.push(args.join(" "));
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

    // Should only be called once (no retries for 413)
    expect(getFetchCalls()).toHaveLength(1);
  });

  test("413 with onError: warn logs payload size warning", async () => {
    mockFetch([build413Response()]);

    const errors: string[] = [];
    const origError = console.error;
    console.error = (...args: unknown[]) => errors.push(args.join(" "));
    const origWrite = process.stderr.write;
    process.stderr.write = () => true;

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
    process.stderr.write = origWrite;

    const sizeMsg = errors.find((e) => e.includes("Payload too large"));
    expect(sizeMsg).toBeDefined();
    expect(sizeMsg).toContain("1.0 MB");
    expect(sizeMsg).toContain("batchSize");
  });

  test("413 with onError: throw raises error with size guidance", async () => {
    mockFetch([build413Response()]);

    const origWrite = process.stderr.write;
    process.stderr.write = () => true;

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

    await expect(reporter.end()).rejects.toThrow("Payload too large");

    process.stderr.write = origWrite;
  });

  test("413 does not set quotaExhausted — remaining batches still sent", async () => {
    // First batch: 413, second batch: 200 OK
    mockFetch([build413Response(), { status: 200 }]);

    const errors: string[] = [];
    const origError = console.error;
    console.error = (...args: unknown[]) => errors.push(args.join(" "));
    const origWrite = process.stderr.write;
    process.stderr.write = () => true;

    const reporter = createReporter({
      apiKey: "sk-test-mock",
      preflight: false,
      retries: 0,
      batchSize: 1,
      onError: "warn",
    });
    reporter.begin();
    // Add 2 evaluations so reporter creates 2 batches
    reporter.onTestEnd(
      makeTestCase("test-1"),
      makeTestResultWithEval(validEvalData),
    );
    reporter.onTestEnd(
      makeTestCase("test-2"),
      makeTestResultWithEval(validEvalData),
    );
    await reporter.end();

    console.error = origError;
    process.stderr.write = origWrite;

    // Both batches should be attempted (413 doesn't stop remaining batches)
    expect(getFetchCalls()).toHaveLength(2);
  });
});
