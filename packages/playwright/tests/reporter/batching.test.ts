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

test.describe("Reporter batching", () => {
  test("sends evaluations in batches", async () => {
    mockFetch([{ status: 200 }]);

    const reporter = createReporter({ apiKey: "sk-test-mock", batchSize: 2 });
    reporter.begin();
    for (let i = 0; i < 5; i++) {
      reporter.onTestEnd(
        makeTestCase(`test-${i}`),
        makeTestResultWithEval(validEvalData),
      );
    }
    await reporter.end();

    const calls = getFetchCalls();
    expect(calls).toHaveLength(3); // 2 + 2 + 1
  });

  test("sends single batch when count <= batchSize", async () => {
    mockFetch([{ status: 200 }]);

    const reporter = createReporter({ apiKey: "sk-test-mock", batchSize: 50 });
    reporter.begin();
    reporter.onTestEnd(
      makeTestCase("test-1"),
      makeTestResultWithEval(validEvalData),
    );
    reporter.onTestEnd(
      makeTestCase("test-2"),
      makeTestResultWithEval(validEvalData),
    );
    await reporter.end();

    expect(getFetchCalls()).toHaveLength(1);
  });

  test("skips ingestion when no evaluations collected", async () => {
    mockFetch([{ status: 200 }]);

    const reporter = createReporter({ apiKey: "sk-test-mock" });
    reporter.begin();
    await reporter.end();

    expect(getFetchCalls()).toHaveLength(0);
  });

  test("includes correct payload structure", async () => {
    mockFetch([{ status: 200 }]);

    const reporter = createReporter({
      apiKey: "sk-test-mock",
      projectSlug: "my-project",
    });
    reporter.begin();
    reporter.onTestEnd(
      makeTestCase("sample test"),
      makeTestResultWithEval(validEvalData),
    );
    await reporter.end();

    const calls = getFetchCalls();
    const body = JSON.parse(calls[0].init?.body as string);
    expect(body.project_slug).toBe("my-project");
    expect(body.run.started_at).toBeTruthy();
    expect(body.evaluations).toHaveLength(1);
    expect(body.evaluations[0].assertion_type).toBe("groundedness");
    expect(body.evaluations[0].test_name).toBe("sample test");
  });
});
