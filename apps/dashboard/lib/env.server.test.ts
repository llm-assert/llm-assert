import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";

describe("serverEnv.STRIPE_SECRET_KEY — key mode validation", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
    // Re-mock server-only after module reset (setup.ts mock is cleared)
    vi.mock("server-only", () => ({}));
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("throws when sk_test_ key is used in production", async () => {
    process.env.VERCEL_ENV = "production";
    process.env.STRIPE_SECRET_KEY = "sk_test_abc123";

    const { serverEnv } = await import("./env.server");
    expect(() => serverEnv.STRIPE_SECRET_KEY).toThrow(
      "STRIPE_SECRET_KEY is a test-mode key but VERCEL_ENV",
    );
  });

  it("throws when rk_test_ restricted key is used in production", async () => {
    process.env.VERCEL_ENV = "production";
    process.env.STRIPE_SECRET_KEY = "rk_test_abc123";

    const { serverEnv } = await import("./env.server");
    expect(() => serverEnv.STRIPE_SECRET_KEY).toThrow(
      "STRIPE_SECRET_KEY is a test-mode key but VERCEL_ENV",
    );
  });

  it("passes when rk_live_ restricted key is used in production", async () => {
    process.env.VERCEL_ENV = "production";
    process.env.STRIPE_SECRET_KEY = "rk_live_abc123";

    const { serverEnv } = await import("./env.server");
    expect(serverEnv.STRIPE_SECRET_KEY).toBe("rk_live_abc123");
  });

  it("passes when sk_live_ key is used in production", async () => {
    process.env.VERCEL_ENV = "production";
    process.env.STRIPE_SECRET_KEY = "sk_live_abc123";

    const { serverEnv } = await import("./env.server");
    expect(serverEnv.STRIPE_SECRET_KEY).toBe("sk_live_abc123");
  });

  it("warns when sk_live_ key is used in non-production", async () => {
    process.env.VERCEL_ENV = "preview";
    process.env.STRIPE_SECRET_KEY = "sk_live_abc123";
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const { serverEnv } = await import("./env.server");
    expect(serverEnv.STRIPE_SECRET_KEY).toBe("sk_live_abc123");
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("live-mode key"),
    );

    warnSpy.mockRestore();
  });

  it("passes when sk_test_ key is used in non-production", async () => {
    process.env.VERCEL_ENV = "preview";
    process.env.STRIPE_SECRET_KEY = "sk_test_abc123";

    const { serverEnv } = await import("./env.server");
    expect(serverEnv.STRIPE_SECRET_KEY).toBe("sk_test_abc123");
  });

  it("caches result — second access does not re-run validation", async () => {
    process.env.VERCEL_ENV = "preview";
    process.env.STRIPE_SECRET_KEY = "sk_live_abc123";
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const { serverEnv } = await import("./env.server");
    void serverEnv.STRIPE_SECRET_KEY; // first access — triggers warn
    void serverEnv.STRIPE_SECRET_KEY; // second access — should be cached
    expect(warnSpy).toHaveBeenCalledTimes(1);

    warnSpy.mockRestore();
  });

  it("warns on unrecognised key prefix", async () => {
    process.env.VERCEL_ENV = "preview";
    process.env.STRIPE_SECRET_KEY = "unknown_prefix_key";
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const { serverEnv } = await import("./env.server");
    expect(serverEnv.STRIPE_SECRET_KEY).toBe("unknown_prefix_key");
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("unrecognised prefix"),
    );

    warnSpy.mockRestore();
  });

  it("passes when key is undefined in non-production", async () => {
    delete process.env.VERCEL_ENV;
    delete process.env.STRIPE_SECRET_KEY;

    const { serverEnv } = await import("./env.server");
    expect(serverEnv.STRIPE_SECRET_KEY).toBeUndefined();
  });
});
