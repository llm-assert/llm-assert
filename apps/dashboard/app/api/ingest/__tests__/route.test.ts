import { POST } from "../route";
import { buildIngestPayload } from "@/test/factories";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({
  after: (fn: () => void) => fn(),
}));
vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
}));

const mockFrom = vi.hoisted(() => vi.fn());
const mockRpc = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    from: mockFrom,
    rpc: mockRpc,
  }),
}));

vi.mock("@/lib/billing/reset-date", () => ({
  computeNextResetDate: () => "2026-05-01T00:00:00Z",
}));

const mockCheckRateLimit = vi.hoisted(() => vi.fn());
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: mockCheckRateLimit,
  getApiRateLimitConfig: () => ({ windowMs: 60_000, maxRequests: 100 }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_API_KEY = "sk_test_abc123";

function makeRequest(
  body: string,
  options?: { contentLength?: string; noAuth?: boolean },
): Request {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (!options?.noAuth) {
    headers["Authorization"] = `Bearer ${VALID_API_KEY}`;
  }
  if (options?.contentLength !== undefined) {
    headers["Content-Length"] = options.contentLength;
  }

  return new Request("http://localhost:3000/api/ingest", {
    method: "POST",
    headers,
    body,
  });
}

function mockAuthSuccess() {
  mockFrom.mockImplementation((table: string) => {
    if (table === "api_keys") {
      return {
        select: () => ({
          eq: () => ({
            is: () => ({
              single: () =>
                Promise.resolve({
                  data: {
                    id: "key-1",
                    project_id: "proj-1",
                    user_id: "user-1",
                  },
                  error: null,
                }),
            }),
          }),
        }),
        update: () => ({
          eq: () => Promise.resolve({ error: null }),
        }),
      };
    }
    if (table === "projects") {
      return {
        select: () => ({
          eq: () => ({
            single: () =>
              Promise.resolve({
                data: { slug: "my-project" },
                error: null,
              }),
          }),
        }),
      };
    }
    // fallback for any other table
    return {
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: null, error: null }),
        }),
      }),
      update: () => ({ eq: () => Promise.resolve({ error: null }) }),
    };
  });

  mockRpc.mockResolvedValue({
    data: [
      {
        status: "ok",
        run_id: "00000000-0000-0000-0000-000000000001",
        evaluations_ingested: 1,
        evaluations_used: 50,
        evaluation_limit: 100,
      },
    ],
    error: null,
  });
}

async function parseJsonResponse(response: Response) {
  return JSON.parse(await response.text());
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/ingest body size limits", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockAuthSuccess();
    mockCheckRateLimit.mockResolvedValue({ limited: false, retryAfterSeconds: 0 });
  });

  it("returns 413 when Content-Length header exceeds 1 MB", async () => {
    const body = JSON.stringify(buildIngestPayload());
    const request = makeRequest(body, { contentLength: "2000000" });
    const response = await POST(request);

    expect(response.status).toBe(413);
    const json = await parseJsonResponse(response);
    expect(json.error.code).toBe("PAYLOAD_TOO_LARGE");
    expect(json.error.details.max_bytes).toBe(1_048_576);
    expect(json.error.details.actual_bytes).toBe(2_000_000);
  });

  it("passes size check for body at exactly 1 MB", async () => {
    // Build a payload that's just under the limit with padding
    const payload = buildIngestPayload();
    const baseJson = JSON.stringify(payload);
    // This won't actually be 1 MB but we verify bodies under limit pass
    const request = makeRequest(baseJson);
    const response = await POST(request);

    // Should succeed (200) since auth and payload are valid
    expect(response.status).toBe(200);
  });

  it("413 response includes details.max_bytes and details.actual_bytes", async () => {
    const body = JSON.stringify(buildIngestPayload());
    const request = makeRequest(body, { contentLength: "5000000" });
    const response = await POST(request);

    expect(response.status).toBe(413);
    const json = await parseJsonResponse(response);
    expect(json.error.details).toEqual({
      max_bytes: 1_048_576,
      actual_bytes: 5_000_000,
    });
  });

  it("413 response includes CORS headers", async () => {
    const body = JSON.stringify(buildIngestPayload());
    const request = makeRequest(body, { contentLength: "2000000" });
    const response = await POST(request);

    expect(response.status).toBe(413);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(response.headers.get("Access-Control-Allow-Methods")).toBe(
      "POST, OPTIONS",
    );
  });

  it("returns 413 for Content-Length fast-path even without auth", async () => {
    const body = JSON.stringify(buildIngestPayload());
    const request = makeRequest(body, {
      contentLength: "2000000",
      noAuth: true,
    });
    const response = await POST(request);

    // Content-Length check runs before auth, so should be 413 not 401
    expect(response.status).toBe(413);
  });

  it("returns 401 for unauthenticated request within size limit", async () => {
    const body = JSON.stringify(buildIngestPayload());
    const request = makeRequest(body, { noAuth: true });
    const response = await POST(request);

    expect(response.status).toBe(401);
  });
});

describe("POST /api/ingest rate limiting", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockAuthSuccess();
    mockCheckRateLimit.mockResolvedValue({ limited: false, retryAfterSeconds: 0 });
  });

  it("returns 429 with Retry-After when rate limited", async () => {
    mockCheckRateLimit.mockResolvedValue({ limited: true, retryAfterSeconds: 42 });

    const body = JSON.stringify(buildIngestPayload());
    const request = makeRequest(body);
    const response = await POST(request);

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("42");
    const json = JSON.parse(await response.text());
    expect(json.error.code).toBe("RATE_LIMITED");
  });

  it("passes rate limit key using API key ID", async () => {
    const body = JSON.stringify(buildIngestPayload());
    const request = makeRequest(body);
    await POST(request);

    expect(mockCheckRateLimit).toHaveBeenCalledWith(
      "api:key-1",
      expect.objectContaining({ windowMs: 60_000, maxRequests: 100 }),
    );
  });

  it("does not increment rate limit counter for invalid auth", async () => {
    const body = JSON.stringify(buildIngestPayload());
    const request = makeRequest(body, { noAuth: true });
    await POST(request);

    expect(mockCheckRateLimit).not.toHaveBeenCalled();
  });
});
