import { test, expect } from "@playwright/test";
import {
  mockFetch,
  restoreFetch,
  buildPreflightOkResponse,
  buildPreflightErrorResponse,
} from "../helpers/mock-fetch.js";
import { preflightCheck } from "../../src/preflight/check.js";

test.afterEach(() => {
  restoreFetch();
});

test("preflightCheck resolves on success", async () => {
  mockFetch([buildPreflightOkResponse()]);

  await expect(
    preflightCheck({ apiKey: "sk_test_123", projectSlug: "test" }),
  ).resolves.toBeUndefined();
});

test("preflightCheck throws on auth failure", async () => {
  mockFetch([
    buildPreflightErrorResponse(
      401,
      "UNAUTHORIZED",
      "Missing or invalid API key",
    ),
  ]);

  await expect(
    preflightCheck({ apiKey: "sk_bad", projectSlug: "test" }),
  ).rejects.toThrow(/Pre-?flight check failed/i);
});

test("preflightCheck throws on quota_exceeded", async () => {
  mockFetch([
    buildPreflightOkResponse({
      status: "quota_exceeded",
      evaluations_used: 100,
      evaluation_limit: 100,
    }),
  ]);

  await expect(
    preflightCheck({ apiKey: "sk_test_123", projectSlug: "test" }),
  ).rejects.toThrow(/[Qq]uota exceeded/);
});

test("preflightCheck throws on network error", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("fetch failed: ECONNREFUSED");
  };

  try {
    await expect(
      preflightCheck({ apiKey: "sk_test_123", projectSlug: "test" }),
    ).rejects.toThrow(/Pre-?flight check failed/i);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("preflightCheck resolves on quota_warning (with console warning)", async () => {
  mockFetch([
    buildPreflightOkResponse({
      status: "quota_warning",
      evaluations_used: 85,
      evaluation_limit: 100,
    }),
  ]);

  await expect(
    preflightCheck({ apiKey: "sk_test_123", projectSlug: "test" }),
  ).resolves.toBeUndefined();
});
