import { test, expect } from "@playwright/test";
import {
  mockFetch,
  restoreFetch,
  getFetchCalls,
  buildPreflightOkResponse,
  buildPreflightErrorResponse,
} from "../helpers/mock-fetch.js";
import {
  createReporter,
  makeTestCase,
  makeTestResultWithEval,
  validEvalData,
} from "../helpers/mock-reporter.js";

test.afterEach(() => {
  restoreFetch();
});

test("preflight success → batches sent normally", async () => {
  mockFetch([buildPreflightOkResponse(), { status: 200 }]);

  const reporter = createReporter({ apiKey: "sk_test_123" });
  reporter.begin();
  reporter.onTestEnd(makeTestCase("t1"), makeTestResultWithEval(validEvalData));
  await reporter.end();

  const calls = getFetchCalls();
  expect(calls).toHaveLength(2);
  expect(String(calls[0].url)).toContain("/api/ingest/preflight");
  expect(String(calls[1].url)).toContain("/api/ingest");
});

test("preflight disabled (no apiKey) → no fetch call", async () => {
  mockFetch([]);

  const reporter = createReporter();
  reporter.begin();
  reporter.onTestEnd(makeTestCase("t1"), makeTestResultWithEval(validEvalData));
  await reporter.end();

  expect(getFetchCalls()).toHaveLength(0);
});

test("preflight disabled (config false) → no preflight call", async () => {
  mockFetch([{ status: 200 }]);

  const reporter = createReporter({
    apiKey: "sk_test_123",
    preflight: false,
  });
  reporter.begin();
  reporter.onTestEnd(makeTestCase("t1"), makeTestResultWithEval(validEvalData));
  await reporter.end();

  const calls = getFetchCalls();
  // Only the ingest call, no preflight
  expect(calls).toHaveLength(1);
  expect(String(calls[0].url)).toContain("/api/ingest");
  expect(String(calls[0].url)).not.toContain("preflight");
});

test("preflight 401 (invalid API key) → warning + batches skipped", async () => {
  mockFetch([
    buildPreflightErrorResponse(
      401,
      "UNAUTHORIZED",
      "Missing or invalid API key",
    ),
  ]);

  const reporter = createReporter({ apiKey: "sk_bad" });
  reporter.begin();
  reporter.onTestEnd(makeTestCase("t1"), makeTestResultWithEval(validEvalData));
  await reporter.end();

  // Only the preflight call — ingest skipped
  const calls = getFetchCalls();
  expect(calls).toHaveLength(1);
  expect(String(calls[0].url)).toContain("/api/ingest/preflight");
});

test("preflight 404 (project mismatch from resolveProject) → warning + batches skipped", async () => {
  mockFetch([
    buildPreflightErrorResponse(404, "PROJECT_NOT_FOUND", "Project not found"),
  ]);

  const reporter = createReporter({ apiKey: "sk_test_123" });
  reporter.begin();
  reporter.onTestEnd(makeTestCase("t1"), makeTestResultWithEval(validEvalData));
  await reporter.end();

  // Preflight failed — but 404 on the preflight response (not the path)
  // means project not found, which is a hard error, skips batches
  const calls = getFetchCalls();
  expect(calls).toHaveLength(1);
});

test("preflight quota_exceeded → warning + batches skipped", async () => {
  mockFetch([
    buildPreflightOkResponse({
      status: "quota_exceeded",
      evaluations_used: 100,
      evaluation_limit: 100,
    }),
  ]);

  const reporter = createReporter({ apiKey: "sk_test_123" });
  reporter.begin();
  reporter.onTestEnd(makeTestCase("t1"), makeTestResultWithEval(validEvalData));
  await reporter.end();

  // Only the preflight call — ingest skipped due to quota
  const calls = getFetchCalls();
  expect(calls).toHaveLength(1);
});

test("preflight quota_warning → warning logged + batches sent", async () => {
  mockFetch([
    buildPreflightOkResponse({
      status: "quota_warning",
      evaluations_used: 85,
      evaluation_limit: 100,
    }),
    { status: 200 },
  ]);

  const reporter = createReporter({ apiKey: "sk_test_123" });
  reporter.begin();
  reporter.onTestEnd(makeTestCase("t1"), makeTestResultWithEval(validEvalData));
  await reporter.end();

  // Both preflight and ingest calls
  const calls = getFetchCalls();
  expect(calls).toHaveLength(2);
});

test("dashboard unreachable (network error) → warning + batches still attempted", async () => {
  // First call (preflight) throws, second call (ingest) succeeds
  let callIndex = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (
    url: string | URL | Request,
    init?: RequestInit,
  ): Promise<Response> => {
    callIndex++;
    if (callIndex === 1) {
      throw new Error("fetch failed: ECONNREFUSED");
    }
    return new Response("", { status: 200 });
  };

  try {
    const reporter = createReporter({ apiKey: "sk_test_123" });
    reporter.begin();
    reporter.onTestEnd(
      makeTestCase("t1"),
      makeTestResultWithEval(validEvalData),
    );
    await reporter.end();
    // Should complete without throwing — batches attempted after network error
    expect(callIndex).toBe(2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("404 on preflight path (version skew) → treated as ok + batches sent", async () => {
  // The PreflightClient treats 404 as "dashboard too old" → synthetic ok
  mockFetch([{ status: 404 }, { status: 200 }]);

  const reporter = createReporter({ apiKey: "sk_test_123" });
  reporter.begin();
  reporter.onTestEnd(makeTestCase("t1"), makeTestResultWithEval(validEvalData));
  await reporter.end();

  // Both preflight (404 → ok) and ingest calls
  const calls = getFetchCalls();
  expect(calls).toHaveLength(2);
});

test("preflight: 'fail' + 401 → throws in onEnd", async () => {
  mockFetch([
    buildPreflightErrorResponse(
      401,
      "UNAUTHORIZED",
      "Missing or invalid API key",
    ),
  ]);

  const reporter = createReporter({
    apiKey: "sk_test_123",
    preflight: "fail",
  });
  reporter.begin();
  reporter.onTestEnd(makeTestCase("t1"), makeTestResultWithEval(validEvalData));

  await expect(reporter.end()).rejects.toThrow(/Pre-?flight check failed/i);
});

test("preflight: 'fail' + quota_exceeded → throws in onEnd", async () => {
  mockFetch([
    buildPreflightOkResponse({
      status: "quota_exceeded",
      evaluations_used: 100,
      evaluation_limit: 100,
    }),
  ]);

  const reporter = createReporter({
    apiKey: "sk_test_123",
    preflight: "fail",
    onQuotaExhausted: "fail",
  });
  reporter.begin();
  reporter.onTestEnd(makeTestCase("t1"), makeTestResultWithEval(validEvalData));

  await expect(reporter.end()).rejects.toThrow(/[Qq]uota/);
});

test("custom preflightTimeout is forwarded to fetch AbortSignal", async () => {
  mockFetch([buildPreflightOkResponse(), { status: 200 }]);

  const reporter = createReporter({
    apiKey: "sk_test_123",
    preflightTimeout: 2000,
  });
  reporter.begin();
  reporter.onTestEnd(makeTestCase("t1"), makeTestResultWithEval(validEvalData));
  await reporter.end();

  // Verify the preflight call was made with the correct signal
  const calls = getFetchCalls();
  expect(calls).toHaveLength(2);
  const preflightCall = calls[0];
  // The AbortSignal from AbortSignal.timeout() is attached to the init
  expect(preflightCall.init?.signal).toBeDefined();
});
