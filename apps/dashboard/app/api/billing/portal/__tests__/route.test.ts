import { POST } from "../route";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const { mockGetUser, mockFrom, mockCreatePortalSession } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockFrom: vi.fn(),
  mockCreatePortalSession: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: () =>
    Promise.resolve({
      auth: { getUser: mockGetUser },
      from: mockFrom,
    }),
}));

vi.mock("@/lib/stripe", () => ({
  stripe: {
    billingPortal: { sessions: { create: mockCreatePortalSession } },
  },
}));

vi.mock("@/lib/env.server", () => ({
  serverEnv: {},
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(): Request {
  return new Request("http://localhost:3000/api/billing/portal", {
    method: "POST",
    headers: { origin: "http://localhost:3000" },
  });
}

function mockSubscriptionQuery(data: { stripe_customer_id: string } | null) {
  const single = vi.fn().mockResolvedValue({ data, error: null });
  const eq = vi.fn().mockReturnValue({ single });
  const select = vi.fn().mockReturnValue({ eq });
  mockFrom.mockReturnValue({ select });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/billing/portal", () => {
  it("returns 401 without auth", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const res = await POST(makeRequest());
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
  });

  it("returns 503 when Stripe is not configured", async () => {
    const mod = await import("@/lib/stripe");
    const original = Object.getOwnPropertyDescriptor(mod, "stripe");
    Object.defineProperty(mod, "stripe", {
      value: undefined,
      writable: true,
      configurable: true,
    });

    const res = await POST(makeRequest());
    expect(res.status).toBe(503);

    Object.defineProperty(mod, "stripe", original!);
  });

  it("returns 404 when user has no subscription", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1", email: "test@example.com" } },
    });
    mockSubscriptionQuery(null);

    const res = await POST(makeRequest());
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toContain("No billing account found");
  });

  it("returns 404 when subscription row has empty stripe_customer_id", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1", email: "test@example.com" } },
    });
    mockSubscriptionQuery({ stripe_customer_id: "" });

    const res = await POST(makeRequest());
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toContain("No billing account found");
  });

  it("returns 200 with portal URL for existing subscriber", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1", email: "test@example.com" } },
    });
    mockSubscriptionQuery({ stripe_customer_id: "cus_123" });
    mockCreatePortalSession.mockResolvedValue({
      url: "https://billing.stripe.com/portal_session_abc",
    });

    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      url: "https://billing.stripe.com/portal_session_abc",
    });

    expect(mockCreatePortalSession).toHaveBeenCalledWith({
      customer: "cus_123",
      return_url: "http://localhost:3000/settings/billing",
    });
  });
});
