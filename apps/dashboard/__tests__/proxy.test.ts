import { proxy } from "../proxy";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock publicEnv — default to production custom domain
const mockPublicEnv = vi.hoisted(() => ({
  NEXT_PUBLIC_APP_URL: "https://llmassert.com",
  NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "test-key",
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_test_123",
}));

vi.mock("@/lib/env", () => ({
  publicEnv: mockPublicEnv,
}));

// Mock Supabase SSR — track whether createServerClient is called
const mockGetUser = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
);
const mockCreateServerClient = vi.hoisted(() =>
  vi.fn().mockReturnValue({
    auth: { getUser: mockGetUser },
  }),
);

vi.mock("@supabase/ssr", () => ({
  createServerClient: mockCreateServerClient,
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function makeRequest(
  url: string,
  host: string,
  method = "GET",
): Promise<import("next/server").NextRequest> {
  const { NextRequest } = await import("next/server");
  const req = new NextRequest(new URL(url, `https://${host}`), { method });
  // NextRequest uses the URL host, but proxy reads from the "host" header
  req.headers.set("host", host);
  return req;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("proxy — FEAT-106 hostname redirect", () => {
  const originalVercelEnv = process.env.VERCEL_ENV;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPublicEnv.NEXT_PUBLIC_APP_URL = "https://llmassert.com";
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    mockCreateServerClient.mockReturnValue({
      auth: { getUser: mockGetUser },
    });
  });

  afterEach(() => {
    process.env.VERCEL_ENV = originalVercelEnv;
  });

  // 3.2: .vercel.app in production → 301 redirect with path + query preserved
  it("redirects .vercel.app to custom domain in production with path and query preserved", async () => {
    process.env.VERCEL_ENV = "production";
    const req = await makeRequest(
      "/dashboard/projects/my-project?tab=evaluations",
      "llmassert-dashboard.vercel.app",
    );

    const res = await proxy(req);

    expect(res.status).toBe(301);
    const location = res.headers.get("location")!;
    expect(location).toContain("https://llmassert.com");
    expect(location).toContain("/dashboard/projects/my-project");
    expect(location).toContain("tab=evaluations");
  });

  // 3.3: request on custom domain → no redirect
  it("does not redirect requests already on the custom domain", async () => {
    process.env.VERCEL_ENV = "production";
    const req = await makeRequest("/dashboard", "llmassert.com");

    const res = await proxy(req);

    expect(res.status).not.toBe(301);
  });

  // 3.4: localhost → no redirect
  it("does not redirect localhost requests", async () => {
    process.env.VERCEL_ENV = "production";
    const req = await makeRequest("/dashboard", "localhost:3000");

    const res = await proxy(req);

    expect(res.status).not.toBe(301);
  });

  // 3.5: /api/ingest on .vercel.app → no redirect (API skip)
  it("does not redirect /api/ paths on .vercel.app", async () => {
    process.env.VERCEL_ENV = "production";
    const req = await makeRequest(
      "/api/ingest",
      "llmassert-dashboard.vercel.app",
      "POST",
    );

    const res = await proxy(req);

    expect(res.status).not.toBe(301);
  });

  // 3.6: VERCEL_ENV=preview → no redirect
  it("does not redirect on preview deployments", async () => {
    process.env.VERCEL_ENV = "preview";
    const req = await makeRequest(
      "/dashboard",
      "llmassert-dashboard-abc123.vercel.app",
    );

    const res = await proxy(req);

    expect(res.status).not.toBe(301);
  });

  // VERCEL_ENV=development (Vercel CLI local dev) → no redirect
  it("does not redirect on development environment", async () => {
    process.env.VERCEL_ENV = "development";
    const req = await makeRequest(
      "/dashboard",
      "llmassert-dashboard.vercel.app",
    );

    const res = await proxy(req);

    expect(res.status).not.toBe(301);
  });

  // VERCEL_ENV unset (plain next dev without Vercel CLI) → no redirect
  it("does not redirect when VERCEL_ENV is not set", async () => {
    delete process.env.VERCEL_ENV;
    const req = await makeRequest(
      "/dashboard",
      "llmassert-dashboard.vercel.app",
    );

    const res = await proxy(req);

    expect(res.status).not.toBe(301);
  });

  // 3.7: NEXT_PUBLIC_APP_URL unset (falls back to localhost) → no redirect
  it("does not redirect when NEXT_PUBLIC_APP_URL resolves to localhost", async () => {
    process.env.VERCEL_ENV = "production";
    mockPublicEnv.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
    const req = await makeRequest(
      "/dashboard",
      "llmassert-dashboard.vercel.app",
    );

    const res = await proxy(req);

    expect(res.status).not.toBe(301);
  });

  // 3.8: NEXT_PUBLIC_APP_URL is .vercel.app → no redirect (loop prevention)
  it("does not redirect when NEXT_PUBLIC_APP_URL is a .vercel.app URL (loop prevention)", async () => {
    process.env.VERCEL_ENV = "production";
    mockPublicEnv.NEXT_PUBLIC_APP_URL =
      "https://llmassert-dashboard.vercel.app";
    const req = await makeRequest(
      "/dashboard",
      "llmassert-dashboard.vercel.app",
    );

    const res = await proxy(req);

    expect(res.status).not.toBe(301);
  });

  // Redirect fires before Supabase session refresh
  it("does not call createServerClient for redirected requests", async () => {
    process.env.VERCEL_ENV = "production";
    const req = await makeRequest(
      "/dashboard",
      "llmassert-dashboard.vercel.app",
    );

    await proxy(req);

    expect(mockCreateServerClient).not.toHaveBeenCalled();
  });

  // API health check is not redirected
  it("does not redirect /api/health on .vercel.app", async () => {
    process.env.VERCEL_ENV = "production";
    const req = await makeRequest(
      "/api/health?mode=deep",
      "llmassert-dashboard.vercel.app",
    );

    const res = await proxy(req);

    expect(res.status).not.toBe(301);
  });

  // Malformed NEXT_PUBLIC_APP_URL → no redirect (defensive) + logs error
  it("does not redirect when NEXT_PUBLIC_APP_URL is malformed", async () => {
    process.env.VERCEL_ENV = "production";
    mockPublicEnv.NEXT_PUBLIC_APP_URL = "not-a-valid-url";
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const req = await makeRequest(
      "/dashboard",
      "llmassert-dashboard.vercel.app",
    );

    const res = await proxy(req);

    expect(res.status).not.toBe(301);
    expect(consoleSpy).toHaveBeenCalledWith(
      "[proxy] hostname redirect skipped: invalid NEXT_PUBLIC_APP_URL",
    );
    consoleSpy.mockRestore();
  });

  // Root path redirect preserves just the domain
  it("redirects root path correctly", async () => {
    process.env.VERCEL_ENV = "production";
    const req = await makeRequest("/", "llmassert-dashboard.vercel.app");

    const res = await proxy(req);

    expect(res.status).toBe(301);
    const location = res.headers.get("location")!;
    expect(location).toMatch(/https:\/\/llmassert\.com\/?$/);
  });
});
