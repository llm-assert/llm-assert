import { test, expect } from "@playwright/test";
import { JudgeClient } from "../../src/judge/client.js";
import type { JudgeProvider } from "../../src/judge/providers.js";

function mockProvider(name: string, response: string | Error): JudgeProvider {
  return {
    name,
    async call(): Promise<string> {
      if (response instanceof Error) throw response;
      return response;
    },
  };
}

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

test.describe("JudgeParseError handling", () => {
  test("parse error does NOT trigger fallback", async () => {
    const fallbackCalled = { value: false };
    const client = withMockProviders(createBareClient(), [
      mockProvider("primary", "not valid json"),
      {
        name: "fallback",
        async call() {
          fallbackCalled.value = true;
          return '{"score": 0.9, "reasoning": "ok"}';
        },
      },
    ]);

    const result = await client.evaluate("sys", "usr");
    expect(result.response.score).toBeNull();
    expect(result.failureReason).toBe("parse_error");
    expect(fallbackCalled.value).toBe(false);
  });

  test("invalid score returns parse_error, not fallback", async () => {
    const client = withMockProviders(createBareClient(), [
      mockProvider("primary", '{"score": 1.5, "reasoning": "bad"}'),
      mockProvider("fallback", '{"score": 0.8, "reasoning": "ok"}'),
    ]);

    const result = await client.evaluate("sys", "usr");
    expect(result.response.score).toBeNull();
    expect(result.failureReason).toBe("parse_error");
  });

  test("reasoning is capped at 1000 characters", async () => {
    const longReasoning = "x".repeat(2000);
    const client = withMockProviders(createBareClient(), [
      mockProvider(
        "primary",
        JSON.stringify({ score: 0.8, reasoning: longReasoning }),
      ),
    ]);

    const result = await client.evaluate("sys", "usr");
    expect(result.response.reasoning.length).toBeLessThanOrEqual(1000);
    expect(result.response.score).toBe(0.8);
  });

  test("control characters stripped from reasoning", async () => {
    const client = withMockProviders(createBareClient(), [
      mockProvider(
        "primary",
        JSON.stringify({
          score: 0.8,
          reasoning: "Valid\x00with\x01control\x02chars",
        }),
      ),
    ]);

    const result = await client.evaluate("sys", "usr");
    expect(result.response.reasoning).toBe("Validwithcontrolchars");
  });

  test("newlines and tabs preserved in reasoning", async () => {
    const client = withMockProviders(createBareClient(), [
      mockProvider(
        "primary",
        JSON.stringify({
          score: 0.8,
          reasoning: "Line one\nLine two\tTabbed",
        }),
      ),
    ]);

    const result = await client.evaluate("sys", "usr");
    expect(result.response.reasoning).toContain("\n");
    expect(result.response.reasoning).toContain("\t");
  });
});
