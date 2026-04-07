import { test, expect } from "@playwright/test";
import {
  createReporter,
  makeTestCase,
  makeTestResultWithEval,
  validEvalData,
} from "../helpers/mock-reporter.js";
import {
  mockFetch,
  getFetchCalls,
  restoreFetch,
} from "../helpers/mock-fetch.js";

test.afterEach(() => {
  restoreFetch();
});

test.describe("Reporter CI detection", () => {
  test("detects GitHub Actions", async () => {
    const origCI = process.env.CI;
    const origGHA = process.env.GITHUB_ACTIONS;
    process.env.CI = "true";
    process.env.GITHUB_ACTIONS = "true";

    mockFetch([{ status: 200 }]);

    const reporter = createReporter({
      apiKey: "sk-test-mock",
      preflight: false,
    });
    reporter.begin();
    reporter.onTestEnd(
      makeTestCase("test"),
      makeTestResultWithEval(validEvalData),
    );
    await reporter.end();

    const body = JSON.parse(getFetchCalls()[0].init?.body as string);
    expect(body.run.ci_provider).toBe("github-actions");

    process.env.CI = origCI;
    process.env.GITHUB_ACTIONS = origGHA;
  });

  test("skips ingestion when no API key", async () => {
    mockFetch([{ status: 200 }]);

    const reporter = createReporter(); // No apiKey
    reporter.begin();
    reporter.onTestEnd(
      makeTestCase("test"),
      makeTestResultWithEval(validEvalData),
    );
    await reporter.end();

    expect(getFetchCalls()).toHaveLength(0);
  });
});
