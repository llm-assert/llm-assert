import { test, expect } from "@playwright/test";
import {
  createReporter,
  makeTestCase,
  makeTestResultWithEval,
  validEvalData,
} from "../helpers/mock-reporter.js";
import { mockFetch, getFetchCalls, restoreFetch } from "../helpers/mock-fetch.js";

test.afterEach(() => {
  restoreFetch();
});

test.describe("Reporter retry", () => {
  test("retries on 500 and succeeds", async () => {
    mockFetch([{ status: 500, body: "error" }, { status: 200 }]);

    const reporter = createReporter({
      apiKey: "sk-test-mock",
      retries: 1,
      onError: "silent",
    });
    reporter.begin();
    reporter.onTestEnd(makeTestCase("test"), makeTestResultWithEval(validEvalData));
    await reporter.end();

    expect(getFetchCalls()).toHaveLength(2);
  });

  test("exhausts retries and handles error", async () => {
    mockFetch([
      { status: 500, body: "error" },
      { status: 500, body: "error again" },
    ]);

    const reporter = createReporter({
      apiKey: "sk-test-mock",
      retries: 1,
      onError: "silent",
    });
    reporter.begin();
    reporter.onTestEnd(makeTestCase("test"), makeTestResultWithEval(validEvalData));
    await reporter.end();

    expect(getFetchCalls()).toHaveLength(2);
  });
});
