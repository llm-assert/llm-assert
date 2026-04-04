import { GET, OPTIONS } from "../route";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("server-only", () => ({}));

const mockFrom = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    from: mockFrom,
  }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(mode?: string): Request {
  const url =
    "http://localhost:3000/api/health" + (mode ? `?mode=${mode}` : "");
  return new Request(url, { method: "GET" });
}

function mockDbSuccess(data = [{ id: "proj-1" }]) {
  mockFrom.mockReturnValue({
    select: () => ({
      limit: () => Promise.resolve({ data, error: null }),
    }),
  });
}

function mockDbError(message = "connection refused") {
  mockFrom.mockReturnValue({
    select: () => ({
      limit: () => Promise.resolve({ data: null, error: { message } }),
    }),
  });
}

function mockDbTimeout() {
  mockFrom.mockReturnValue({
    select: () => ({
      limit: () => new Promise(() => {}), // never resolves
    }),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/health", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.npm_package_version = "0.1.0";
    process.env.VERCEL_GIT_COMMIT_SHA = "abc1234567890";
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // --- Shallow checks ---

  it("returns 200 with healthy status for default (no mode param)", async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.status).toBe("healthy");
    expect(body.version).toBe("0.1.0");
    expect(body.commit).toBe("abc1234");
    expect(body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    expect(body.checks).toBeUndefined();
  });

  it("returns identical response for ?mode=shallow", async () => {
    const res = await GET(makeRequest("shallow"));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.status).toBe("healthy");
    expect(body.version).toBe("0.1.0");
    expect(body.commit).toBe("abc1234");
  });

  it("defaults to shallow for unknown mode values", async () => {
    const res = await GET(makeRequest("invalid"));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.status).toBe("healthy");
    expect(body.checks).toBeUndefined();
  });

  it("returns null version and commit when env vars are unset", async () => {
    delete process.env.npm_package_version;
    delete process.env.VERCEL_GIT_COMMIT_SHA;

    const res = await GET(makeRequest());
    const body = await res.json();
    expect(body.version).toBeNull();
    expect(body.commit).toBeNull();
  });

  // --- Deep checks ---

  it("returns 200 with db ok and latencyMs on healthy DB", async () => {
    mockDbSuccess();

    const res = await GET(makeRequest("deep"));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.status).toBe("healthy");
    expect(body.checks.db.status).toBe("ok");
    expect(typeof body.checks.db.latencyMs).toBe("number");
  });

  it("returns 503 with db error on DB failure", async () => {
    mockDbError("Connection refused: db.xyz.supabase.co:5432");

    const res = await GET(makeRequest("deep"));
    expect(res.status).toBe(503);

    const body = await res.json();
    expect(body.status).toBe("unhealthy");
    expect(body.checks.db.status).toBe("error");
    // Must NOT leak internal details
    expect(body.checks.db.latencyMs).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain("supabase.co");
  });

  it("returns 200 degraded with db timeout on slow DB", async () => {
    vi.useFakeTimers();
    mockDbTimeout();

    const promise = GET(makeRequest("deep"));
    await vi.advanceTimersByTimeAsync(3100);

    const res = await promise;
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.status).toBe("degraded");
    expect(body.checks.db.status).toBe("timeout");
  });

  it("returns 200 degraded with db misconfigured when env var missing", async () => {
    // Re-mock admin to throw (simulating missing env var validation)
    vi.doMock("@/lib/supabase/admin", () => ({
      supabaseAdmin: () => {
        throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
      },
    }));

    // Re-import route to pick up the new mock
    const { GET: freshGET } = await import("../route");
    const res = await freshGET(makeRequest("deep"));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.status).toBe("degraded");
    expect(body.checks.db.status).toBe("misconfigured");
    // Must NOT leak error details
    expect(JSON.stringify(body)).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });

  // --- Cache headers ---

  it("sets short-TTL cache headers on shallow response", async () => {
    const res = await GET(makeRequest());
    expect(res.headers.get("cache-control")).toBe(
      "public, max-age=10, s-maxage=10, stale-while-revalidate=5",
    );
  });

  it("sets no-store cache header on deep response", async () => {
    mockDbSuccess();
    const res = await GET(makeRequest("deep"));
    expect(res.headers.get("cache-control")).toBe("no-store");
  });
});

// --- OPTIONS ---

describe("OPTIONS /api/health", () => {
  it("returns 204 with CORS headers", () => {
    const res = OPTIONS();
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    expect(res.headers.get("access-control-allow-methods")).toContain("GET");
  });
});
