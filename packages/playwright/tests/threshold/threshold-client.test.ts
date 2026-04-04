import { test, expect } from "@playwright/test";
import {
  mockFetch,
  getFetchCalls,
  restoreFetch,
} from "../helpers/mock-fetch.js";
import { ThresholdClient } from "../../src/threshold/client.js";

const CONFIG = {
  dashboardUrl: "https://llmassert.com",
  apiKey: "sk_test_abc123",
  projectSlug: "my-project",
};

test.afterEach(() => restoreFetch());

test.describe("ThresholdClient", () => {
  test("fetches thresholds with Bearer auth", async () => {
    mockFetch([
      {
        status: 200,
        body: JSON.stringify({
          data: {
            groundedness: 0.85,
            pii: 0.9,
            sentiment: 0.7,
            schema: 0.8,
            fuzzy: 0.75,
          },
        }),
      },
    ]);

    const client = new ThresholdClient(CONFIG);
    const result = await client.fetch();

    expect(result).toEqual({
      groundedness: 0.85,
      pii: 0.9,
      sentiment: 0.7,
      schema: 0.8,
      fuzzy: 0.75,
    });

    const calls = getFetchCalls();
    expect(calls).toHaveLength(1);
    expect(String(calls[0].url)).toBe(
      "https://llmassert.com/api/projects/my-project/thresholds",
    );
    expect(
      (calls[0].init?.headers as Record<string, string>)?.Authorization,
    ).toBe("Bearer sk_test_abc123");
  });

  test("throws on non-200 response", async () => {
    mockFetch([{ status: 401, body: '{"error":{"code":"UNAUTHORIZED"}}' }]);

    const client = new ThresholdClient(CONFIG);
    await expect(client.fetch()).rejects.toThrow("Threshold fetch failed: 401");
  });

  test("throws on invalid response shape", async () => {
    mockFetch([{ status: 200, body: '{"unexpected": true}' }]);

    const client = new ThresholdClient(CONFIG);
    await expect(client.fetch()).rejects.toThrow(
      "Threshold fetch returned invalid response shape",
    );
  });

  test("handles partial thresholds (not all 5 types)", async () => {
    mockFetch([
      {
        status: 200,
        body: JSON.stringify({
          data: { groundedness: 0.85, pii: 0.95 },
        }),
      },
    ]);

    const client = new ThresholdClient(CONFIG);
    const result = await client.fetch();

    expect(result).toEqual({ groundedness: 0.85, pii: 0.95 });
  });

  test("encodes project slug in URL", async () => {
    mockFetch([
      { status: 200, body: JSON.stringify({ data: { groundedness: 0.7 } }) },
    ]);

    const client = new ThresholdClient({
      ...CONFIG,
      projectSlug: "my project",
    });
    await client.fetch();

    const calls = getFetchCalls();
    expect(String(calls[0].url)).toContain("my%20project");
  });
});
