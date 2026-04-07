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
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
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
      const logSpy = vi.spyOn(console, "log");

      await GET(makeRequest(`Bearer ${CRON_SECRET}`));

      const logged = logSpy.mock.calls.find(
        (call) =>
          typeof call[0] === "string" && call[0].includes('"event":"no_drift"'),
      );
      expect(logged).toBeDefined();
      const entry = JSON.parse(logged![0] as string);
      expect(entry.source).toBe("cron-reconcile");
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
            delta: 2, // run_counter delta is always non-negative
          },
        ],
        error: null,
      });
      const logSpy = vi.spyOn(console, "log");

      await GET(makeRequest(`Bearer ${CRON_SECRET}`));

      const driftLog = logSpy.mock.calls.find(
        (call) =>
          typeof call[0] === "string" &&
          call[0].includes('"event":"drift_detected"'),
      );
      expect(driftLog).toBeDefined();
      const entry = JSON.parse(driftLog![0] as string);
      expect(entry.severity).toBe("normal");
      expect(entry.drift_type).toBe("run_counter");
      expect(entry.run_id).toBe("run-uuid-1");
    });

    it("classifies abnormal drift severity for large deltas and logs to stderr", async () => {
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
      const errorSpy = vi.spyOn(console, "error");

      await GET(makeRequest(`Bearer ${CRON_SECRET}`));

      const driftLog = errorSpy.mock.calls.find(
        (call) =>
          typeof call[0] === "string" &&
          call[0].includes('"event":"drift_detected"'),
      );
      expect(driftLog).toBeDefined();
      const entry = JSON.parse(driftLog![0] as string);
      expect(entry.severity).toBe("abnormal");
      expect(entry.drift_type).toBe("run_counter");
      expect(entry.delta).toBe(15);
    });

    it("uses user_id field for quota drift type", async () => {
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
      // Quota delta=10 > threshold=5, so abnormal → console.error
      const errorSpy = vi.spyOn(console, "error");

      await GET(makeRequest(`Bearer ${CRON_SECRET}`));

      const driftLog = errorSpy.mock.calls.find(
        (call) =>
          typeof call[0] === "string" &&
          call[0].includes('"event":"drift_detected"'),
      );
      expect(driftLog).toBeDefined();
      const entry = JSON.parse(driftLog![0] as string);
      expect(entry.user_id).toBe("user-uuid-1");
      expect(entry.run_id).toBeUndefined();
    });

    it("emits success terminal event with counts", async () => {
      mockRpc.mockResolvedValue({ data: driftRows, error: null });
      const logSpy = vi.spyOn(console, "log");

      await GET(makeRequest(`Bearer ${CRON_SECRET}`));

      const logged = logSpy.mock.calls.find(
        (call) =>
          typeof call[0] === "string" && call[0].includes('"event":"success"'),
      );
      expect(logged).toBeDefined();
      const entry = JSON.parse(logged![0] as string);
      expect(entry.source).toBe("cron-reconcile");
      expect(entry.drifted_runs).toBe(2);
      expect(entry.drifted_users).toBe(1);
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
      const logSpy = vi.spyOn(console, "log");

      await GET(makeRequest(`Bearer ${CRON_SECRET}`));

      const driftLog = logSpy.mock.calls.find(
        (call) =>
          typeof call[0] === "string" &&
          call[0].includes('"event":"drift_detected"'),
      );
      expect(driftLog).toBeDefined();
      const entry = JSON.parse(driftLog![0] as string);
      expect(entry.severity).toBe("normal");
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
      const logSpy = vi.spyOn(console, "log");

      await GET(makeRequest(`Bearer ${CRON_SECRET}`));

      const driftLog = logSpy.mock.calls.find(
        (call) =>
          typeof call[0] === "string" &&
          call[0].includes('"event":"drift_detected"'),
      );
      expect(driftLog).toBeDefined();
      const entry = JSON.parse(driftLog![0] as string);
      expect(entry.severity).toBe("normal");
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

  describe("logging", () => {
    it("logs auth_failure on unauthorized access", async () => {
      const errorSpy = vi.spyOn(console, "error");

      await GET(makeRequest("Bearer wrong"));

      const logged = errorSpy.mock.calls.find(
        (call) =>
          typeof call[0] === "string" &&
          call[0].includes('"event":"auth_failure"'),
      );
      expect(logged).toBeDefined();
      const entry = JSON.parse(logged![0] as string);
      expect(entry.source).toBe("cron-reconcile");
    });
  });
});
