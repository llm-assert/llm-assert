import { test, expect } from "@playwright/test";
import { JudgeClient } from "../../src/judge/client.js";
import type { JudgeProvider } from "../../src/judge/providers.js";
import { FakeClock } from "../helpers/fake-clock.js";

function mockProvider(response: string): JudgeProvider {
  return {
    name: "mock",
    async call() {
      return { text: response };
    },
  };
}

interface JudgeClientInternals {
  providers: JudgeProvider[];
  anthropicInitPromise: Promise<void> | null;
}

function withMockProvider(
  client: JudgeClient,
  provider: JudgeProvider,
): JudgeClient {
  const internals = client as unknown as JudgeClientInternals;
  internals.providers = [provider];
  internals.anthropicInitPromise = null;
  return client;
}

const VALID_RESPONSE = '{"score": 0.8, "reasoning": "ok"}';

test.describe("Token bucket rate limiter", () => {
  test("calls within burst capacity proceed immediately", async () => {
    const clock = new FakeClock();
    const client = new JudgeClient(
      {
        openaiApiKey: undefined,
        anthropicApiKey: undefined,
        rateLimit: { requestsPerMinute: 60, burstCapacity: 5 },
      },
      clock,
    );
    withMockProvider(client, mockProvider(VALID_RESPONSE));

    // 5 calls should succeed without delay
    for (let i = 0; i < 5; i++) {
      const result = await client.evaluate("sys", "usr");
      expect(result.response.score).toBe(0.8);
    }
  });

  test("call beyond burst capacity waits for token", async () => {
    const clock = new FakeClock();
    const client = new JudgeClient(
      {
        openaiApiKey: undefined,
        anthropicApiKey: undefined,
        rateLimit: { requestsPerMinute: 60, burstCapacity: 2 },
      },
      clock,
    );
    withMockProvider(client, mockProvider(VALID_RESPONSE));

    const timeBefore = clock.now();

    // Exhaust burst capacity
    await client.evaluate("sys", "usr");
    await client.evaluate("sys", "usr");

    // Third call should auto-advance the clock via FakeClock.sleep
    const result = await client.evaluate("sys", "usr");
    expect(result.response.score).toBe(0.8);

    // Clock should have advanced for the token wait
    expect(clock.now()).toBeGreaterThan(timeBefore);
  });

  test("custom rate configuration respected", async () => {
    const clock = new FakeClock();
    const client = new JudgeClient(
      {
        openaiApiKey: undefined,
        anthropicApiKey: undefined,
        rateLimit: { requestsPerMinute: 30, burstCapacity: 1 },
      },
      clock,
    );
    withMockProvider(client, mockProvider(VALID_RESPONSE));

    const timeBefore = clock.now();

    // One call succeeds
    await client.evaluate("sys", "usr");

    // Second call auto-advances clock for the wait
    const result = await client.evaluate("sys", "usr");
    expect(result.response.score).toBe(0.8);

    // 30 req/min = 0.5 req/s = 2000ms per token — clock should advance ~2000ms
    expect(clock.now() - timeBefore).toBeGreaterThanOrEqual(1900);
  });

  test("resetForTesting restores burst capacity", async () => {
    const clock = new FakeClock();
    const client = new JudgeClient(
      {
        openaiApiKey: undefined,
        anthropicApiKey: undefined,
        rateLimit: { requestsPerMinute: 60, burstCapacity: 1 },
      },
      clock,
    );
    withMockProvider(client, mockProvider(VALID_RESPONSE));

    // Exhaust capacity
    await client.evaluate("sys", "usr");

    // Reset
    client.resetForTesting();

    // Should succeed immediately again
    const result = await client.evaluate("sys", "usr");
    expect(result.response.score).toBe(0.8);
  });

  test("no rate limiting when not configured", async () => {
    const clock = new FakeClock();
    const client = new JudgeClient(
      {
        openaiApiKey: undefined,
        anthropicApiKey: undefined,
        // No rateLimit config
      },
      clock,
    );
    withMockProvider(client, mockProvider(VALID_RESPONSE));

    const timeBefore = clock.now();

    // Should handle many calls without any rate-limit-induced time advance
    for (let i = 0; i < 20; i++) {
      const result = await client.evaluate("sys", "usr");
      expect(result.response.score).toBe(0.8);
    }

    // No time should have advanced (no rate limit sleeps)
    expect(clock.now()).toBe(timeBefore);
  });
});
