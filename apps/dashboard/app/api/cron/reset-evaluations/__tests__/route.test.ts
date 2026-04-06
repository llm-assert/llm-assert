import { GET, maxDuration } from "../route";
import * as routeModule from "../route";

// ---------------------------------------------------------------------------
// Mocks — vi.mock factories are hoisted, so they CANNOT reference top-level
// variables. All values must be inlined or use vi.hoisted().
// ---------------------------------------------------------------------------

const { CRON_SECRET, mockRpc } = vi.hoisted(() => ({
  CRON_SECRET: "cron_test_secret_for_unit_tests_64chars_minimum_hex_value_ok",
  mockRpc: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    rpc: mockRpc,
  }),
}));

vi.mock("@/lib/env.server", () => ({
  serverEnv: {
    get CRON_SECRET() {
      return CRON_SECRET;
    },
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(token?: string): Request {
  const headers: Record<string, string> = {};
  if (token !== undefined) {
    headers["authorization"] = token;
  }
  return new Request("http://localhost:3000/api/cron/reset-evaluations", {
    method: "GET",
    headers,
  });
}

function resetMocks() {
  mockRpc.mockReset().mockResolvedValue({
    data: [{ paid_reset_count: 0, free_reset_count: 0 }],
    error: null,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  resetMocks();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("GET /api/cron/reset-evaluations", () => {
  describe("route exports", () => {
    it("exports maxDuration of 60", () => {
      expect(maxDuration).toBe(60);
    });

    it("exports only GET and maxDuration", () => {
      const exports = Object.keys(routeModule);
      expect(exports).toContain("GET");
      expect(exports).toContain("maxDuration");
      expect(exports).not.toContain("POST");
      expect(exports).not.toContain("PUT");
      expect(exports).not.toContain("DELETE");
    });
  });

  describe("auth guard", () => {
    it("returns 200 with valid CRON_SECRET", async () => {
      const res = await GET(makeRequest(`Bearer ${CRON_SECRET}`));
      expect(res.status).toBe(200);
    });

    it("returns 401 when Authorization header is missing", async () => {
      const res = await GET(makeRequest());
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toBe("Unauthorized");
    });

    it("returns 401 when CRON_SECRET is wrong", async () => {
      const res = await GET(makeRequest("Bearer wrong_secret_value"));
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toBe("Unauthorized");
    });

    it("returns 401 when CRON_SECRET env var is not configured", async () => {
      const mod = await import("@/lib/env.server");
      const original = Object.getOwnPropertyDescriptor(
        mod.serverEnv,
        "CRON_SECRET",
      );
      Object.defineProperty(mod.serverEnv, "CRON_SECRET", {
        get: () => undefined,
        configurable: true,
      });

      const res = await GET(makeRequest(`Bearer ${CRON_SECRET}`));
      expect(res.status).toBe(401);

      // Restore
      Object.defineProperty(mod.serverEnv, "CRON_SECRET", original!);
    });

    it("returns 401 when Authorization header lacks Bearer prefix", async () => {
      const res = await GET(makeRequest(CRON_SECRET));
      expect(res.status).toBe(401);
    });

    it("does not make database calls on auth failure", async () => {
      await GET(makeRequest("Bearer wrong"));
      expect(mockRpc).not.toHaveBeenCalled();
    });
  });

  describe("paid subscription reset", () => {
    it("calls reset_evaluations_for_period RPC", async () => {
      mockRpc.mockResolvedValue({
        data: [{ paid_reset_count: 3, free_reset_count: 0 }],
        error: null,
      });

      const res = await GET(makeRequest(`Bearer ${CRON_SECRET}`));
      expect(res.status).toBe(200);
      expect(mockRpc).toHaveBeenCalledWith("reset_evaluations_for_period");

      const json = await res.json();
      expect(json.paid_reset_count).toBe(3);
      expect(json.free_reset_count).toBe(0);
    });
  });

  describe("free tier reset", () => {
    it("returns free_reset_count from RPC result", async () => {
      mockRpc.mockResolvedValue({
        data: [{ paid_reset_count: 0, free_reset_count: 12 }],
        error: null,
      });

      const res = await GET(makeRequest(`Bearer ${CRON_SECRET}`));
      const json = await res.json();
      expect(json.free_reset_count).toBe(12);
    });
  });

  describe("edge cases", () => {
    it("returns success with zero counts when no subscriptions qualify", async () => {
      mockRpc.mockResolvedValue({
        data: [{ paid_reset_count: 0, free_reset_count: 0 }],
        error: null,
      });

      const res = await GET(makeRequest(`Bearer ${CRON_SECRET}`));
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.paid_reset_count).toBe(0);
      expect(json.free_reset_count).toBe(0);
    });

    it("returns 500 when Supabase RPC fails", async () => {
      mockRpc.mockResolvedValue({
        data: null,
        error: { code: "42501", message: "permission denied" },
      });

      const res = await GET(makeRequest(`Bearer ${CRON_SECRET}`));
      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.error).toBe("Internal server error");
    });

    it("does not expose database error details in response", async () => {
      mockRpc.mockResolvedValue({
        data: null,
        error: { code: "42501", message: "sensitive_error_details" },
      });

      const res = await GET(makeRequest(`Bearer ${CRON_SECRET}`));
      const json = await res.json();
      expect(json.error).not.toContain("sensitive_error_details");
    });
  });

  describe("idempotency", () => {
    it("returns zero counts on second invocation (no rows to reset)", async () => {
      // First call: some resets happen
      mockRpc.mockResolvedValueOnce({
        data: [{ paid_reset_count: 5, free_reset_count: 3 }],
        error: null,
      });

      const res1 = await GET(makeRequest(`Bearer ${CRON_SECRET}`));
      expect(res1.status).toBe(200);
      const json1 = await res1.json();
      expect(json1.paid_reset_count).toBe(5);

      // Second call: function returns zeros (already reset)
      mockRpc.mockResolvedValueOnce({
        data: [{ paid_reset_count: 0, free_reset_count: 0 }],
        error: null,
      });

      const res2 = await GET(makeRequest(`Bearer ${CRON_SECRET}`));
      expect(res2.status).toBe(200);
      const json2 = await res2.json();
      expect(json2.paid_reset_count).toBe(0);
      expect(json2.free_reset_count).toBe(0);
    });
  });

  describe("logging", () => {
    it("logs success with reset counts and duration", async () => {
      const logSpy = vi.spyOn(console, "log");
      mockRpc.mockResolvedValue({
        data: [{ paid_reset_count: 2, free_reset_count: 7 }],
        error: null,
      });

      await GET(makeRequest(`Bearer ${CRON_SECRET}`));

      const logged = logSpy.mock.calls.find(
        (call) =>
          typeof call[0] === "string" && call[0].includes('"event":"success"'),
      );
      expect(logged).toBeDefined();
      const entry = JSON.parse(logged![0] as string);
      expect(entry.source).toBe("cron-reset");
      expect(entry.paid_reset_count).toBe(2);
      expect(entry.free_reset_count).toBe(7);
      expect(entry.duration_ms).toBeGreaterThanOrEqual(0);
    });

    it("logs auth_failure on unauthorized access", async () => {
      const errorSpy = vi.spyOn(console, "error");

      await GET(makeRequest("Bearer wrong"));

      const logged = errorSpy.mock.calls.find(
        (call) =>
          typeof call[0] === "string" &&
          call[0].includes('"event":"auth_failure"'),
      );
      expect(logged).toBeDefined();
    });

    it("logs error on database failure", async () => {
      const errorSpy = vi.spyOn(console, "error");
      mockRpc.mockResolvedValue({
        data: null,
        error: { code: "42501", message: "db error" },
      });

      await GET(makeRequest(`Bearer ${CRON_SECRET}`));

      const logged = errorSpy.mock.calls.find(
        (call) =>
          typeof call[0] === "string" && call[0].includes('"event":"error"'),
      );
      expect(logged).toBeDefined();
      const entry = JSON.parse(logged![0] as string);
      expect(entry.error).toBe("db error");
    });
  });
});
