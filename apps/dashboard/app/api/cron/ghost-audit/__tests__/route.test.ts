import { GET, maxDuration } from "../route";
import * as routeModule from "../route";

// ---------------------------------------------------------------------------
// Mocks
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
  return new Request("http://localhost:3000/api/cron/ghost-audit", {
    method: "GET",
    headers,
  });
}

function makeCleanResult() {
  return {
    ghost_count: 0,
    definite_count: 0,
    possible_noop_count: 0,
    event_types: [],
    oldest_ghost_at: null,
    newest_ghost_at: null,
    sample_event_ids: [],
  };
}

function makeGhostResult(overrides?: Record<string, unknown>) {
  return {
    ghost_count: 3,
    definite_count: 2,
    possible_noop_count: 1,
    event_types: [
      "checkout.session.completed",
      "customer.subscription.updated",
    ],
    oldest_ghost_at: "2026-04-04T10:00:00Z",
    newest_ghost_at: "2026-04-07T14:30:00Z",
    sample_event_ids: ["evt_ghost_1", "evt_ghost_2", "evt_ghost_3"],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockRpc.mockReset().mockResolvedValue({
    data: makeCleanResult(),
    error: null,
  });
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/cron/ghost-audit", () => {
  describe("route exports", () => {
    it("exports maxDuration of 30", () => {
      expect(maxDuration).toBe(30);
    });

    it("exports only GET and maxDuration", () => {
      const exports = Object.keys(routeModule);
      expect(exports).toContain("GET");
      expect(exports).toContain("maxDuration");
      expect(exports).not.toContain("POST");
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

    it("does not make database calls on auth failure", async () => {
      await GET(makeRequest("Bearer wrong"));
      expect(mockRpc).not.toHaveBeenCalled();
    });
  });

  describe("clean state (no ghosts)", () => {
    it("returns ok with zero ghost count", async () => {
      mockRpc.mockResolvedValue({ data: makeCleanResult(), error: null });

      const res = await GET(makeRequest(`Bearer ${CRON_SECRET}`));
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.ok).toBe(true);
      expect(json.data.ghost_count).toBe(0);
      expect(json.data.definite_count).toBe(0);
      expect(json.data.possible_noop_count).toBe(0);
      expect(json.duration_ms).toBeGreaterThanOrEqual(0);
    });

    it("emits ghost_audit_clean at INFO level", async () => {
      mockRpc.mockResolvedValue({ data: makeCleanResult(), error: null });
      const logSpy = vi.spyOn(console, "log");

      await GET(makeRequest(`Bearer ${CRON_SECRET}`));

      const logged = logSpy.mock.calls.find(
        (call) =>
          typeof call[0] === "string" &&
          call[0].includes('"event":"ghost_audit_clean"'),
      );
      expect(logged).toBeDefined();
      const entry = JSON.parse(logged![0] as string);
      expect(entry.source).toBe("cron-ghost-audit");
      expect(entry.ghost_count).toBe(0);
    });

    it("does not emit to console.error when clean", async () => {
      mockRpc.mockResolvedValue({ data: makeCleanResult(), error: null });
      const errorSpy = vi.spyOn(console, "error");

      await GET(makeRequest(`Bearer ${CRON_SECRET}`));

      const ghostLog = errorSpy.mock.calls.find(
        (call) =>
          typeof call[0] === "string" &&
          call[0].includes('"event":"ghost_events_detected"'),
      );
      expect(ghostLog).toBeUndefined();
    });
  });

  describe("ghosts detected", () => {
    it("returns ok with ghost data", async () => {
      mockRpc.mockResolvedValue({ data: makeGhostResult(), error: null });

      const res = await GET(makeRequest(`Bearer ${CRON_SECRET}`));
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.ok).toBe(true);
      expect(json.data.ghost_count).toBe(3);
      expect(json.data.definite_count).toBe(2);
      expect(json.data.possible_noop_count).toBe(1);
      expect(json.data.sample_event_ids).toHaveLength(3);
    });

    it("emits ghost_events_detected at ERROR level when definite_count > 0", async () => {
      mockRpc.mockResolvedValue({ data: makeGhostResult(), error: null });
      const errorSpy = vi.spyOn(console, "error");

      await GET(makeRequest(`Bearer ${CRON_SECRET}`));

      const logged = errorSpy.mock.calls.find(
        (call) =>
          typeof call[0] === "string" &&
          call[0].includes('"event":"ghost_events_detected"'),
      );
      expect(logged).toBeDefined();
      const entry = JSON.parse(logged![0] as string);
      expect(entry.source).toBe("cron-ghost-audit");
      expect(entry.ghost_count).toBe(3);
      expect(entry.definite_count).toBe(2);
      expect(entry.oldest_ghost_at).toBe("2026-04-04T10:00:00Z");
      expect(entry.newest_ghost_at).toBe("2026-04-07T14:30:00Z");
      expect(entry.sample_event_ids).toHaveLength(3);
    });

    it("emits clean log when only possible_noop ghosts exist", async () => {
      const noopOnly = makeGhostResult({
        ghost_count: 2,
        definite_count: 0,
        possible_noop_count: 2,
      });
      mockRpc.mockResolvedValue({ data: noopOnly, error: null });
      const logSpy = vi.spyOn(console, "log");
      const errorSpy = vi.spyOn(console, "error");

      await GET(makeRequest(`Bearer ${CRON_SECRET}`));

      // Should use INFO level (no definite ghosts)
      const infoLog = logSpy.mock.calls.find(
        (call) =>
          typeof call[0] === "string" &&
          call[0].includes('"event":"ghost_audit_clean"'),
      );
      expect(infoLog).toBeDefined();

      // Should NOT emit error-level ghost detection
      const errorLog = errorSpy.mock.calls.find(
        (call) =>
          typeof call[0] === "string" &&
          call[0].includes('"event":"ghost_events_detected"'),
      );
      expect(errorLog).toBeUndefined();
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
      expect(entry.source).toBe("cron-ghost-audit");
    });

    it("calls ghost_event_audit RPC by name", async () => {
      await GET(makeRequest(`Bearer ${CRON_SECRET}`));
      expect(mockRpc).toHaveBeenCalledWith("ghost_event_audit");
    });
  });
});
