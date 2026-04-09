import { verifyCronSecret, logCron } from "../utils";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const { CRON_SECRET, mockLoggerInfo, mockLoggerError } = vi.hoisted(() => ({
  CRON_SECRET: "cron_test_secret_for_unit_tests_64chars_minimum_hex_value_ok",
  mockLoggerInfo: vi.fn(),
  mockLoggerError: vi.fn(),
}));

vi.mock("@/lib/env.server", () => ({
  serverEnv: {
    get CRON_SECRET() {
      return CRON_SECRET;
    },
  },
}));

vi.mock("@/lib/logger", () => {
  const mockLogger = {
    info: mockLoggerInfo,
    error: mockLoggerError,
    warn: vi.fn(),
    debug: vi.fn(),
    child: vi.fn(() => mockLogger),
  };
  return {
    logger: mockLogger,
    createLogger: vi.fn(() => mockLogger),
  };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(token?: string): Request {
  const headers: Record<string, string> = {};
  if (token !== undefined) {
    headers["authorization"] = token;
  }
  return new Request("http://localhost:3000/api/cron/test", {
    method: "GET",
    headers,
  });
}

// ---------------------------------------------------------------------------
// Tests: verifyCronSecret
// ---------------------------------------------------------------------------

describe("verifyCronSecret", () => {
  it("returns true for valid Bearer token", () => {
    expect(verifyCronSecret(makeRequest(`Bearer ${CRON_SECRET}`))).toBe(true);
  });

  it("returns false for invalid token", () => {
    expect(verifyCronSecret(makeRequest("Bearer wrong_secret"))).toBe(false);
  });

  it("returns false when Authorization header is missing", () => {
    expect(verifyCronSecret(makeRequest())).toBe(false);
  });

  it("returns false when header lacks Bearer prefix", () => {
    expect(verifyCronSecret(makeRequest(CRON_SECRET))).toBe(false);
  });

  it("returns false on length mismatch without throwing", () => {
    expect(verifyCronSecret(makeRequest("Bearer short"))).toBe(false);
  });

  it("returns false when CRON_SECRET env var is not configured", async () => {
    const mod = await import("@/lib/env.server");
    const original = Object.getOwnPropertyDescriptor(
      mod.serverEnv,
      "CRON_SECRET",
    );
    Object.defineProperty(mod.serverEnv, "CRON_SECRET", {
      get: () => undefined,
      configurable: true,
    });

    try {
      expect(verifyCronSecret(makeRequest(`Bearer ${CRON_SECRET}`))).toBe(
        false,
      );
    } finally {
      Object.defineProperty(mod.serverEnv, "CRON_SECRET", original!);
    }
  });
});

// ---------------------------------------------------------------------------
// Tests: logCron
// ---------------------------------------------------------------------------

describe("logCron", () => {
  beforeEach(() => {
    mockLoggerInfo.mockClear();
    mockLoggerError.mockClear();
  });

  it("logs success events at info level", () => {
    logCron("cron-test", "success", { count: 5 });

    expect(mockLoggerInfo).toHaveBeenCalledOnce();
    expect(mockLoggerInfo.mock.calls[0][0]).toMatchObject({
      event: "success",
      count: 5,
    });
  });

  it("logs error events at error level", () => {
    logCron("cron-test", "error", { error: "db failure" });

    expect(mockLoggerError).toHaveBeenCalledOnce();
    expect(mockLoggerError.mock.calls[0][0]).toMatchObject({
      event: "error",
    });
  });

  it("logs auth_failure events at error level", () => {
    logCron("cron-test", "auth_failure");

    expect(mockLoggerError).toHaveBeenCalledOnce();
  });

  it("handles missing details parameter", () => {
    logCron("cron-test", "no_drift");

    expect(mockLoggerInfo).toHaveBeenCalledOnce();
    expect(mockLoggerInfo.mock.calls[0][0]).toMatchObject({
      event: "no_drift",
    });
  });
});
