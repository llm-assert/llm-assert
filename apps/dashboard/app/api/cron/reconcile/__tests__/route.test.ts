import { GET, maxDuration } from "../route";
import * as routeModule from "../route";

// ---------------------------------------------------------------------------
// Mocks — vi.mock factories are hoisted, so they CANNOT reference top-level
// variables. All values must be inlined or use vi.hoisted().
// ---------------------------------------------------------------------------

const { CRON_SECRET, mockRpc, mockLoggerInfo, mockLoggerError } = vi.hoisted(
  () => ({
    CRON_SECRET:
      "cron_test_secret_for_unit_tests_64chars_minimum_hex_value_ok",
    mockRpc: vi.fn(),
    mockLoggerInfo: vi.fn(),
    mockLoggerError: vi.fn(),
  }),
);

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

vi.mock("@/lib/logger", () => ({
  createLogger: vi.fn((source: string) => ({
    info: (...args: unknown[]) =>
      mockLoggerInfo(
        { source, ...(args[0] as Record<string, unknown>) },
        args[1],
      ),
    error: (...args: unknown[]) =>
      mockLoggerError(
        { source, ...(args[0] as Record<string, unknown>) },
        args[1],
      ),
    warn: vi.fn(),
    debug: vi.fn(),
    child: vi.fn(),
  })),
  logger: {},
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(token?: string): Request {
  const headers: Record<string, string> = {};
  if (token !== undefined) {
    headers["authorization"] = token;
  }
  return new Request("http://localhost:3000/api/cron/reconcile", {
    method: "GET",
    headers,
  });
}

function resetMocks() {
  mockRpc.mockReset().mockResolvedValue({
    data: [],
    error: null,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  resetMocks();
  mockLoggerInfo.mockClear();
  mockLoggerError.mockClear();
});

describe("GET /api/cron/reconcile", () => {
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

      try {
        const res = await GET(makeRequest(`Bearer ${CRON_SECRET}`));
        expect(res.status).toBe(401);
      } finally {
        Object.defineProperty(mod.serverEnv, "CRON_SECRET", original!);
      }
    });

    it("does not make database calls on auth failure", async () => {
      await GET(makeRequest("Bearer wrong"));
      expect(mockRpc).not.toHaveBeenCalled();
    });
  });

  describe("no drift (happy path)", () => {
    it("returns success with zero drift counts", async () => {
      mockRpc.mockResolvedValue({ data: [], error: null });

      const res = await GET(makeRequest(`Bearer ${CRON_SECRET}`));
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.drifted_runs).toBe(0);
      expect(json.drifted_users).toBe(0);
      expect(json.max_drift).toBe(0);
      expect(json.duration_ms).toBeGreaterThanOrEqual(0);
    });

    it("emits no_drift terminal event", async () => {
      mockRpc.mockResolvedValue({ data: [], error: null });

      await GET(makeRequest(`Bearer ${CRON_SECRET}`));

      const logged = mockLoggerInfo.mock.calls.find(
        (call) => call[0]?.event === "no_drift",
      );
      expect(logged).toBeDefined();
      expect(logged![0].source).toBe("cron-reconcile");
    });
  });

  describe("drift detected", () => {
    const driftRows = [
      {
        kind: "run_counter",
        entity_id: "run-uuid-1",
        stored_value: 10,
        actual_value: 8,
        delta: 2, // run_counter delta is always non-negative (GREATEST(abs(...)))
      },
      {
        kind: "run_counter",
        entity_id: "run-uuid-2",
        stored_value: 5,
        actual_value: 20,
        delta: 15,
      },
      {
        kind: "quota",
        entity_id: "user-uuid-1",
        stored_value: 80,
        actual_value: 70,
        delta: -10, // quota delta can be negative (actual - stored)
      },
    ];

    it("returns correct aggregate counts", async () => {
      mockRpc.mockResolvedValue({ data: driftRows, error: null });

      const res = await GET(makeRequest(`Bearer ${CRON_SECRET}`));
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.drifted_runs).toBe(2);
      expect(json.drifted_users).toBe(1);
      expect(json.max_drift).toBe(15);
    });

    it("classifies normal drift severity for small deltas", async () => {
      mockRpc.mockResolvedValue({
        data: [
          {
            kind: "run_counter",
            entity_id: "run-uuid-1",
            stored_value: 10,
            actual_value: 8,
            delta: 2,
          },
        ],
        error: null,
      });

      await GET(makeRequest(`Bearer ${CRON_SECRET}`));

      const driftLog = mockLoggerInfo.mock.calls.find(
        (call) => call[0]?.event === "drift_detected",
      );
      expect(driftLog).toBeDefined();
      expect(driftLog![0].severity).toBe("normal");
      expect(driftLog![0].driftType).toBe("run_counter");
      expect(driftLog![0].entityId).toBe("run-uuid-1");
    });

    it("classifies abnormal drift severity for large deltas and logs at error level", async () => {
      mockRpc.mockResolvedValue({
        data: [
          {
            kind: "run_counter",
            entity_id: "run-uuid-2",
            stored_value: 5,
            actual_value: 20,
            delta: 15,
          },
        ],
        error: null,
      });

      await GET(makeRequest(`Bearer ${CRON_SECRET}`));

      const driftLog = mockLoggerError.mock.calls.find(
        (call) => call[0]?.event === "drift_detected",
      );
      expect(driftLog).toBeDefined();
      expect(driftLog![0].severity).toBe("abnormal");
      expect(driftLog![0].driftType).toBe("run_counter");
      expect(driftLog![0].delta).toBe(15);
    });

    it("uses entityId field for quota drift type", async () => {
      mockRpc.mockResolvedValue({
        data: [
          {
            kind: "quota",
            entity_id: "user-uuid-1",
            stored_value: 80,
            actual_value: 70,
            delta: -10,
          },
        ],
        error: null,
      });

      await GET(makeRequest(`Bearer ${CRON_SECRET}`));

      const driftLog = mockLoggerError.mock.calls.find(
        (call) => call[0]?.event === "drift_detected",
      );
      expect(driftLog).toBeDefined();
      expect(driftLog![0].entityId).toBe("user-uuid-1");
    });

    it("emits success terminal event with counts", async () => {
      mockRpc.mockResolvedValue({ data: driftRows, error: null });

      await GET(makeRequest(`Bearer ${CRON_SECRET}`));

      const logged = mockLoggerInfo.mock.calls.find(
        (call) => call[0]?.event === "success",
      );
      expect(logged).toBeDefined();
      expect(logged![0].source).toBe("cron-reconcile");
      expect(logged![0].drifted_runs).toBe(2);
      expect(logged![0].drifted_users).toBe(1);
    });

    it("run counter delta=10 (at threshold) is classified as normal", async () => {
      mockRpc.mockResolvedValue({
        data: [
          {
            kind: "run_counter",
            entity_id: "run-boundary",
            stored_value: 20,
            actual_value: 10,
            delta: 10,
          },
        ],
        error: null,
      });

      await GET(makeRequest(`Bearer ${CRON_SECRET}`));

      const driftLog = mockLoggerInfo.mock.calls.find(
        (call) => call[0]?.event === "drift_detected",
      );
      expect(driftLog).toBeDefined();
      expect(driftLog![0].severity).toBe("normal");
    });

    it("quota delta=5 (at threshold) is classified as normal", async () => {
      mockRpc.mockResolvedValue({
        data: [
          {
            kind: "quota",
            entity_id: "user-boundary",
            stored_value: 55,
            actual_value: 50,
            delta: 5,
          },
        ],
        error: null,
      });

      await GET(makeRequest(`Bearer ${CRON_SECRET}`));

      const driftLog = mockLoggerInfo.mock.calls.find(
        (call) => call[0]?.event === "drift_detected",
      );
      expect(driftLog).toBeDefined();
      expect(driftLog![0].severity).toBe("normal");
    });
  });

  describe("error handling", () => {
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
        error: { code: "42501", message: "sensitive_details" },
      });

      const res = await GET(makeRequest(`Bearer ${CRON_SECRET}`));
      const json = await res.json();
      expect(json.error).not.toContain("sensitive_details");
    });

    it("logs error on database failure", async () => {
      mockRpc.mockResolvedValue({
        data: null,
        error: { code: "42501", message: "db error" },
      });

      await GET(makeRequest(`Bearer ${CRON_SECRET}`));

      const logged = mockLoggerError.mock.calls.find(
        (call) => call[0]?.event === "error",
      );
      expect(logged).toBeDefined();
      expect(logged![0].error).toBe("db error");
    });
  });

  describe("logging", () => {
    it("logs auth_failure on unauthorized access", async () => {
      await GET(makeRequest("Bearer wrong"));

      const logged = mockLoggerError.mock.calls.find(
        (call) => call[0]?.event === "auth_failure",
      );
      expect(logged).toBeDefined();
      expect(logged![0].source).toBe("cron-reconcile");
    });
  });
});
