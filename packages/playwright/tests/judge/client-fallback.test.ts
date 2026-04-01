import { test, expect } from "@playwright/test";
import { JudgeClient } from "../../src/judge/client.js";
import type { JudgeProvider } from "../../src/judge/providers.js";

function mockProvider(
  name: string,
  response: string | Error,
): JudgeProvider {
  return {
    name,
    async call(): Promise<string> {
      if (response instanceof Error) throw response;
      return response;
    },
  };
}

/** Access JudgeClient internals for testing the fallback chain */
interface JudgeClientInternals {
  providers: JudgeProvider[];
  anthropicInitPromise: Promise<void> | null;
}

function withMockProviders(
  client: JudgeClient,
  providers: JudgeProvider[],
): JudgeClient {
  const internals = client as unknown as JudgeClientInternals;
  internals.providers = providers;
  internals.anthropicInitPromise = null;
  return client;
}

function createBareClient(): JudgeClient {
  return new JudgeClient({
    openaiApiKey: undefined,
    anthropicApiKey: undefined,
  });
}

test.describe("JudgeClient fallback chain", () => {
  test("returns result from primary provider", async () => {
    const client = withMockProviders(createBareClient(), [
      mockProvider("primary", '{"score": 0.8, "reasoning": "ok"}'),
    ]);

    const result = await client.evaluate("system", "user");
    expect(result.response.score).toBe(0.8);
    expect(result.fallbackUsed).toBe(false);
  });

  test("falls back when primary fails", async () => {
    const client = withMockProviders(createBareClient(), [
      mockProvider("primary", new Error("API error")),
      mockProvider("fallback", '{"score": 0.7, "reasoning": "fallback ok"}'),
    ]);

    const result = await client.evaluate("system", "user");
    expect(result.response.score).toBe(0.7);
    expect(result.fallbackUsed).toBe(true);
  });

  test("returns inconclusive when all providers fail", async () => {
    const client = withMockProviders(createBareClient(), [
      mockProvider("primary", new Error("fail 1")),
      mockProvider("fallback", new Error("fail 2")),
    ]);

    const result = await client.evaluate("system", "user");
    expect(result.response.score).toBe(-1);
    expect(result.model).toBe("none");
    expect(result.fallbackUsed).toBe(false);
  });

  test("falls back on invalid JSON from provider", async () => {
    const client = withMockProviders(createBareClient(), [
      mockProvider("primary", "not json at all"),
      mockProvider("fallback", '{"score": 0.6, "reasoning": "parsed ok"}'),
    ]);

    const result = await client.evaluate("system", "user");
    expect(result.response.score).toBe(0.6);
    expect(result.fallbackUsed).toBe(true);
  });
});
