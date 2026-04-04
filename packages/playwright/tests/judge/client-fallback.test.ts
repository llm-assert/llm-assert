import { test, expect } from "@playwright/test";
import { JudgeClient } from "../../src/judge/client.js";
import type {
  JudgeProvider,
  ProviderResult,
} from "../../src/judge/providers.js";
import { RateLimitError } from "../../src/judge/providers.js";
import { FakeClock } from "../helpers/fake-clock.js";
import type { TokenUsage } from "../../src/types.js";

function mockProvider(
  name: string,
  response: string | Error,
  usage?: TokenUsage,
): JudgeProvider {
  return {
    name,
    async call(): Promise<ProviderResult> {
      if (response instanceof Error) throw response;
      return { text: response, usage };
    },
  };
}

/** Provider that fails N times then succeeds */
function flakyProvider(
  name: string,
  failCount: number,
  error: Error,
  successResponse: string,
  usage?: TokenUsage,
): JudgeProvider {
  let calls = 0;
  return {
    name,
    async call(): Promise<ProviderResult> {
      calls++;
      if (calls <= failCount) throw error;
      return { text: successResponse, usage };
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

function createBareClient(clock?: FakeClock): JudgeClient {
  return new JudgeClient(
    {
      openaiApiKey: undefined,
      anthropicApiKey: undefined,
    },
    clock,
  );
}

test.describe("JudgeClient fallback chain", () => {
  test("returns result from primary provider", async () => {
    const client = withMockProviders(createBareClient(), [
      mockProvider("primary", '{"score": 0.8, "reasoning": "ok"}'),
    ]);

    const result = await client.evaluate("system", "user");
    expect(result.response.score).toBe(0.8);
    expect(result.fallbackUsed).toBe(false);
    expect(result.failureReason).toBeNull();
    expect(result.backoffMs).toBe(0);
  });

  test("falls back when primary fails", async () => {
    const client = withMockProviders(createBareClient(), [
      mockProvider("primary", new Error("API error")),
      mockProvider("fallback", '{"score": 0.7, "reasoning": "fallback ok"}'),
    ]);

    const result = await client.evaluate("system", "user");
    expect(result.response.score).toBe(0.7);
    expect(result.fallbackUsed).toBe(true);
    expect(result.failureReason).toBeNull();
  });

  test("returns inconclusive when all providers fail", async () => {
    const client = withMockProviders(createBareClient(), [
      mockProvider("primary", new Error("fail 1")),
      mockProvider("fallback", new Error("fail 2")),
    ]);

    const result = await client.evaluate("system", "user");
    expect(result.response.score).toBeNull();
    expect(result.model).toBe("none");
    expect(result.fallbackUsed).toBe(false);
    expect(result.failureReason).toBe("provider_error");
  });
});

test.describe("429 retry with backoff", () => {
  test("retries on 429 and succeeds", async () => {
    const clock = new FakeClock();
    const client = withMockProviders(createBareClient(clock), [
      flakyProvider(
        "primary",
        1,
        new RateLimitError("openai"),
        '{"score": 0.85, "reasoning": "ok after retry"}',
      ),
    ]);

    // FakeClock.sleep auto-advances time, so this resolves immediately
    const result = await client.evaluate("sys", "usr");
    expect(result.response.score).toBe(0.85);
    expect(result.fallbackUsed).toBe(false);
    expect(result.backoffMs).toBeGreaterThan(0);
  });

  test("exhausts retries then falls to fallback", async () => {
    const clock = new FakeClock();

    const alwaysRateLimited: JudgeProvider = {
      name: "primary",
      async call(): Promise<ProviderResult> {
        throw new RateLimitError("openai");
      },
    };

    const client = withMockProviders(createBareClient(clock), [
      alwaysRateLimited,
      mockProvider("fallback", '{"score": 0.7, "reasoning": "fallback"}'),
    ]);

    const result = await client.evaluate("sys", "usr");
    expect(result.response.score).toBe(0.7);
    expect(result.fallbackUsed).toBe(true);
    expect(result.backoffMs).toBeGreaterThan(0);
  });

  test("all providers rate limited returns inconclusive with rate_limited reason", async () => {
    const clock = new FakeClock();

    const rateLimited: JudgeProvider = {
      name: "provider",
      async call(): Promise<ProviderResult> {
        throw new RateLimitError("provider");
      },
    };

    const client = withMockProviders(createBareClient(clock), [
      rateLimited,
      { ...rateLimited, name: "fallback" },
    ]);

    const result = await client.evaluate("sys", "usr");
    expect(result.response.score).toBeNull();
    expect(result.failureReason).toBe("rate_limited");
    expect(result.backoffMs).toBeGreaterThan(0);
  });

  test("returns usage and cost on successful evaluation", async () => {
    const usage = { inputTokens: 500, outputTokens: 80 };
    const client = withMockProviders(createBareClient(), [
      mockProvider("primary", '{"score": 0.9, "reasoning": "good"}', usage),
    ]);

    const result = await client.evaluate("system", "user");
    expect(result.usage).toEqual(usage);
    expect(result.costUsd).toBeDefined();
    expect(typeof result.costUsd).toBe("number");
    expect(result.costUsd!).toBeGreaterThan(0);
  });

  test("cost uses fallback model pricing when fallback succeeds", async () => {
    const usage = { inputTokens: 600, outputTokens: 90 };
    const client = withMockProviders(createBareClient(), [
      mockProvider("primary", new Error("API error")),
      mockProvider("fallback", '{"score": 0.7, "reasoning": "ok"}', usage),
    ]);

    const result = await client.evaluate("system", "user");
    expect(result.fallbackUsed).toBe(true);
    expect(result.usage).toEqual(usage);
    // Cost should be defined (claude-3-5-haiku is in the price table)
    expect(result.costUsd).toBeDefined();
  });

  test("usage and cost are undefined when all providers fail", async () => {
    const client = withMockProviders(createBareClient(), [
      mockProvider("primary", new Error("fail")),
      mockProvider("fallback", new Error("fail")),
    ]);

    const result = await client.evaluate("system", "user");
    expect(result.response.score).toBeNull();
    expect(result.usage).toBeUndefined();
    expect(result.costUsd).toBeUndefined();
  });
});
