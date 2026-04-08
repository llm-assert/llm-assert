import { GET, OPTIONS } from "../route";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("server-only", () => ({}));

const mockResolveAuth = vi.hoisted(() => vi.fn());
const mockResolveProject = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api/auth", () => {
  class AuthError extends Error {
    code: string;
    status: number;
    constructor(code: string, message: string, status: number) {
      super(message);
      this.code = code;
      this.status = status;
    }
  }
  return {
    resolveAuth: mockResolveAuth,
    resolveProject: mockResolveProject,
    AuthError,
  };
});

const mockFrom = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    from: mockFrom,
  }),
}));

const mockCheckRateLimit = vi.hoisted(() => vi.fn());
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: mockCheckRateLimit,
  getPreflightRateLimitConfig: () => ({ windowMs: 60_000, maxRequests: 60 }),
  getClientIp: () => "1.2.3.4",
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(slug?: string, options?: { noAuth?: boolean }): Request {
  const headers: Record<string, string> = {};
  if (!options?.noAuth) {
    headers["Authorization"] = "Bearer sk_test_abc123";
  }

  const url = slug
    ? `http://localhost:3000/api/ingest/preflight?project_slug=${slug}`
    : "http://localhost:3000/api/ingest/preflight";

  return new Request(url, { method: "GET", headers });
}

function mockAuthAndProject() {
  mockResolveAuth.mockResolvedValue({
    userId: "user-1",
    projectId: "proj-1",
    authMethod: "api_key" as const,
  });
  mockResolveProject.mockResolvedValue({
    id: "proj-1",
    name: "My Project",
    slug: "my-project",
    description: null,
  });
}

function mockSubscription(overrides: {
  evaluations_used: number;
  evaluation_limit: number;
  plan: string;
}) {
  mockFrom.mockImplementation((table: string) => {
    if (table === "subscriptions") {
      return {
        select: () => ({
          eq: (_col: string, _val: string) => ({
            eq: (_col2: string, _val2: string) => ({
              maybeSingle: () =>
                Promise.resolve({ data: overrides, error: null }),
            }),
          }),
        }),
      };
    }
    return {};
  });
}

function mockNoSubscription() {
  mockFrom.mockImplementation((table: string) => {
    if (table === "subscriptions") {
      return {
        select: () => ({
          eq: (_col: string, _val: string) => ({
            eq: (_col2: string, _val2: string) => ({
              maybeSingle: () => Promise.resolve({ data: null, error: null }),
            }),
          }),
        }),
      };
    }
    return {};
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  mockCheckRateLimit.mockResolvedValue({ limited: false, retryAfterSeconds: 0 });
});

describe("GET /api/ingest/preflight", () => {
  it("returns 200 with status ok when quota available", async () => {
    mockAuthAndProject();
    mockSubscription({
      evaluations_used: 50,
      evaluation_limit: 100,
      plan: "pro",
    });

    const res = await GET(makeRequest("my-project"));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.data.status).toBe("ok");
    expect(body.data.project).toEqual({
      slug: "my-project",
      name: "My Project",
    });
    expect(body.data.quota).toEqual({
      evaluations_used: 50,
      evaluation_limit: 100,
      plan: "pro",
    });
  });

  it("returns 200 with status quota_warning at 80% usage", async () => {
    mockAuthAndProject();
    mockSubscription({
      evaluations_used: 82,
      evaluation_limit: 100,
      plan: "free",
    });

    const res = await GET(makeRequest("my-project"));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.data.status).toBe("quota_warning");
  });

  it("returns 200 with status quota_exceeded at 100% usage", async () => {
    mockAuthAndProject();
    mockSubscription({
      evaluations_used: 100,
      evaluation_limit: 100,
      plan: "free",
    });

    const res = await GET(makeRequest("my-project"));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.data.status).toBe("quota_exceeded");
  });

  it("returns 401 for invalid API key", async () => {
    const { AuthError } = await import("@/lib/api/auth");
    mockResolveAuth.mockRejectedValue(
      new AuthError("UNAUTHORIZED", "Missing or invalid API key", 401),
    );

    const res = await GET(makeRequest("my-project"));
    expect(res.status).toBe(401);

    const body = await res.json();
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 404 for project slug mismatch", async () => {
    const { AuthError } = await import("@/lib/api/auth");
    mockResolveAuth.mockResolvedValue({
      userId: "user-1",
      projectId: "proj-1",
      authMethod: "api_key" as const,
    });
    mockResolveProject.mockRejectedValue(
      new AuthError("PROJECT_NOT_FOUND", "Project not found", 404),
    );

    const res = await GET(makeRequest("wrong-project"));
    expect(res.status).toBe(404);

    const body = await res.json();
    expect(body.error.code).toBe("PROJECT_NOT_FOUND");
  });

  it("returns 400 when project_slug query param is missing", async () => {
    mockResolveAuth.mockResolvedValue({
      userId: "user-1",
      projectId: "proj-1",
      authMethod: "api_key" as const,
    });

    const res = await GET(makeRequest());
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error.code).toBe("INVALID_REQUEST");
  });

  it("returns 200 with quota_exceeded when no active subscription", async () => {
    mockAuthAndProject();
    mockNoSubscription();

    const res = await GET(makeRequest("my-project"));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.data.status).toBe("quota_exceeded");
    expect(body.data.quota).toEqual({
      evaluations_used: 0,
      evaluation_limit: 0,
      plan: "none",
    });
  });

  it("includes CORS headers on success response", async () => {
    mockAuthAndProject();
    mockSubscription({
      evaluations_used: 10,
      evaluation_limit: 100,
      plan: "free",
    });

    const res = await GET(makeRequest("my-project"));
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("includes CORS headers on error response", async () => {
    const { AuthError } = await import("@/lib/api/auth");
    mockResolveAuth.mockRejectedValue(
      new AuthError("UNAUTHORIZED", "Missing or invalid API key", 401),
    );

    const res = await GET(makeRequest("my-project"));
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });
});

describe("GET /api/ingest/preflight rate limiting", () => {
  it("returns 429 with Retry-After when IP is rate limited", async () => {
    mockCheckRateLimit.mockResolvedValue({ limited: true, retryAfterSeconds: 30 });

    const res = await GET(makeRequest("my-project"));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("30");

    const body = await res.json();
    expect(body.error.code).toBe("RATE_LIMITED");
  });

  it("rate limit check runs before auth", async () => {
    mockCheckRateLimit.mockResolvedValue({ limited: true, retryAfterSeconds: 10 });

    const res = await GET(makeRequest("my-project", { noAuth: true }));
    // Should be 429 (rate limited), not 401 (unauthorized)
    expect(res.status).toBe(429);
    expect(mockResolveAuth).not.toHaveBeenCalled();
  });
});

describe("OPTIONS /api/ingest/preflight", () => {
  it("returns 204 with CORS headers", () => {
    const res = OPTIONS();
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(res.headers.get("Access-Control-Allow-Methods")).toContain("GET");
  });
});
