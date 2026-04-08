import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock server-only (imported by rate-limit.ts)
vi.mock("server-only", () => ({}));

import {
  InMemoryStore,
  checkRateLimit,
  setRateLimitStore,
  getClientIp,
  type RateLimitConfig,
} from "./rate-limit";

describe("InMemoryStore", () => {
  let store: InMemoryStore;

  beforeEach(() => {
    store = new InMemoryStore();
  });

  it("counts requests within a window", async () => {
    const r1 = await store.increment("key-a", 60_000);
    expect(r1.count).toBe(1);

    const r2 = await store.increment("key-a", 60_000);
    expect(r2.count).toBe(2);

    const r3 = await store.increment("key-a", 60_000);
    expect(r3.count).toBe(3);
  });

  it("isolates counters per key", async () => {
    await store.increment("key-a", 60_000);
    await store.increment("key-a", 60_000);
    const rA = await store.increment("key-a", 60_000);

    const rB = await store.increment("key-b", 60_000);

    expect(rA.count).toBe(3);
    expect(rB.count).toBe(1);
  });

  it("resets counter after window expires", async () => {
    vi.useFakeTimers();
    try {
      await store.increment("key-a", 1_000);
      await store.increment("key-a", 1_000);
      const r1 = await store.increment("key-a", 1_000);
      expect(r1.count).toBe(3);

      // Advance past the window
      vi.advanceTimersByTime(1_001);

      const r2 = await store.increment("key-a", 1_000);
      expect(r2.count).toBe(1); // Window reset
    } finally {
      vi.useRealTimers();
    }
  });

  it("returns correct resetAtMs", async () => {
    vi.useFakeTimers({ now: 10_000 });
    try {
      const r = await store.increment("key-a", 5_000);
      expect(r.resetAtMs).toBe(15_000); // 10000 + 5000
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("checkRateLimit", () => {
  const config: RateLimitConfig = { windowMs: 60_000, maxRequests: 3 };

  beforeEach(() => {
    setRateLimitStore(new InMemoryStore());
  });

  it("allows requests within limit", async () => {
    const r1 = await checkRateLimit("test-key", config);
    expect(r1.limited).toBe(false);

    const r2 = await checkRateLimit("test-key", config);
    expect(r2.limited).toBe(false);

    const r3 = await checkRateLimit("test-key", config);
    expect(r3.limited).toBe(false);
  });

  it("blocks requests exceeding limit", async () => {
    await checkRateLimit("test-key", config);
    await checkRateLimit("test-key", config);
    await checkRateLimit("test-key", config);

    const r4 = await checkRateLimit("test-key", config);
    expect(r4.limited).toBe(true);
    expect(r4.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("uses separate counters per key", async () => {
    // Exhaust key-a
    await checkRateLimit("key-a", config);
    await checkRateLimit("key-a", config);
    await checkRateLimit("key-a", config);
    const rA = await checkRateLimit("key-a", config);
    expect(rA.limited).toBe(true);

    // key-b should still be allowed
    const rB = await checkRateLimit("key-b", config);
    expect(rB.limited).toBe(false);
  });
});

describe("getClientIp", () => {
  function makeRequest(headers: Record<string, string>): Request {
    return new Request("https://example.com", {
      headers: new Headers(headers),
    });
  }

  it("extracts IP from x-forwarded-for (first entry)", () => {
    const req = makeRequest({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" });
    expect(getClientIp(req)).toBe("1.2.3.4");
  });

  it("falls back to x-real-ip", () => {
    const req = makeRequest({ "x-real-ip": "10.0.0.1" });
    expect(getClientIp(req)).toBe("10.0.0.1");
  });

  it("prefers x-forwarded-for over x-real-ip", () => {
    const req = makeRequest({
      "x-forwarded-for": "1.2.3.4",
      "x-real-ip": "10.0.0.1",
    });
    expect(getClientIp(req)).toBe("1.2.3.4");
  });

  it("returns 'unknown' when no IP headers present", () => {
    const req = makeRequest({});
    expect(getClientIp(req)).toBe("unknown");
  });
});
