import { POST } from "../route";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const { mockGetUser, mockFrom, mockCreateSession } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockFrom: vi.fn(),
  mockCreateSession: vi.fn(),
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
    checkout: { sessions: { create: mockCreateSession } },
  },
}));

vi.mock("@/lib/env.server", () => ({
  serverEnv: {
    STRIPE_STARTER_PRICE_ID: "price_starter_test",
    STRIPE_PRO_PRICE_ID: "price_pro_test",
    STRIPE_TEAM_PRICE_ID: "price_team_test",
  },
}));

vi.mock("@/lib/plans", () => ({
  planFromPriceId: (priceId: string) => {
    const plans: Record<string, { name: string; evaluationLimit: number }> = {
      price_starter_test: { name: "starter", evaluationLimit: 5000 },
      price_pro_test: { name: "pro", evaluationLimit: 25000 },
      price_team_test: { name: "team", evaluationLimit: 100000 },
    };
    return plans[priceId] ?? null;
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(body?: unknown): Request {
  return new Request("http://localhost:3000/api/billing/checkout", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "http://localhost:3000",
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

function mockSubscriptionQuery(
  data: {
    stripe_customer_id: string | null;
    status: string;
    plan?: string;
  } | null,
) {
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

describe("POST /api/billing/checkout", () => {
  it("returns 401 without auth", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const res = await POST(makeRequest({ priceId: "price_starter_test" }));
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

    const res = await POST(makeRequest({ priceId: "price_starter_test" }));
    expect(res.status).toBe(503);

    Object.defineProperty(mod, "stripe", original!);
  });

  it("returns 400 for invalid priceId", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1", email: "test@example.com" } },
    });

    const res = await POST(makeRequest({ priceId: "price_unknown" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid price ID" });
  });

  it("returns 400 for missing priceId", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1", email: "test@example.com" } },
    });

    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid price ID" });
  });

  it("returns 409 for active paid subscription", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1", email: "test@example.com" } },
    });
    mockSubscriptionQuery({
      stripe_customer_id: "cus_123",
      status: "active",
      plan: "starter",
    });

    const res = await POST(makeRequest({ priceId: "price_starter_test" }));
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error).toContain("Active subscription exists");
  });

  it("allows checkout for free-tier user with null stripe_customer_id", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1", email: "test@example.com" } },
    });
    mockSubscriptionQuery({
      stripe_customer_id: null,
      status: "active",
      plan: "free",
    });
    mockCreateSession.mockResolvedValue({
      url: "https://checkout.stripe.com/session_free_upgrade",
    });

    const res = await POST(makeRequest({ priceId: "price_starter_test" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      url: "https://checkout.stripe.com/session_free_upgrade",
    });

    // Free-tier user has no Stripe customer — should use customer_email
    expect(mockCreateSession).toHaveBeenCalledWith(
      expect.objectContaining({
        customer_email: "test@example.com",
        client_reference_id: "user-1",
      }),
    );
    expect(mockCreateSession).not.toHaveBeenCalledWith(
      expect.objectContaining({ customer: expect.any(String) }),
    );
  });

  it("allows checkout for downgraded free-tier user with stripe_customer_id", async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: { id: "user-downgraded", email: "downgraded@example.com" },
      },
    });
    mockSubscriptionQuery({
      stripe_customer_id: "cus_returning",
      status: "active",
      plan: "free",
    });
    mockCreateSession.mockResolvedValue({
      url: "https://checkout.stripe.com/session_reupgrade",
    });

    const res = await POST(makeRequest({ priceId: "price_pro_test" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      url: "https://checkout.stripe.com/session_reupgrade",
    });

    // Downgraded user has existing Stripe customer — should reuse it
    expect(mockCreateSession).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: "cus_returning",
        client_reference_id: "user-downgraded",
      }),
    );
    // Should NOT pass customer_email when reusing existing customer
    expect(mockCreateSession).not.toHaveBeenCalledWith(
      expect.objectContaining({ customer_email: expect.any(String) }),
    );
  });

  it("returns 200 with checkout URL when no subscription row exists (backward compat)", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1", email: "test@example.com" } },
    });
    mockSubscriptionQuery(null);
    mockCreateSession.mockResolvedValue({
      url: "https://checkout.stripe.com/session_123",
    });

    const res = await POST(makeRequest({ priceId: "price_starter_test" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      url: "https://checkout.stripe.com/session_123",
    });

    expect(mockCreateSession).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "subscription",
        client_reference_id: "user-1",
        customer_email: "test@example.com",
        line_items: [{ price: "price_starter_test", quantity: 1 }],
        success_url: "http://localhost:3000/settings/billing?checkout=success",
        cancel_url: "http://localhost:3000/settings/billing",
      }),
    );
    // Should NOT pass customer when no existing subscription
    expect(mockCreateSession).not.toHaveBeenCalledWith(
      expect.objectContaining({ customer: expect.any(String) }),
    );
  });

  it("allows checkout for past-due subscription", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1", email: "test@example.com" } },
    });
    mockSubscriptionQuery({
      stripe_customer_id: "cus_pastdue",
      status: "past_due",
    });
    mockCreateSession.mockResolvedValue({
      url: "https://checkout.stripe.com/session_789",
    });

    const res = await POST(makeRequest({ priceId: "price_starter_test" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      url: "https://checkout.stripe.com/session_789",
    });

    expect(mockCreateSession).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: "cus_pastdue",
      }),
    );
  });

  it("returns 200 with checkout URL for returning user (customer reuse path)", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1", email: "test@example.com" } },
    });
    mockSubscriptionQuery({
      stripe_customer_id: "cus_existing",
      status: "canceled",
    });
    mockCreateSession.mockResolvedValue({
      url: "https://checkout.stripe.com/session_456",
    });

    const res = await POST(makeRequest({ priceId: "price_pro_test" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      url: "https://checkout.stripe.com/session_456",
    });

    expect(mockCreateSession).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "subscription",
        client_reference_id: "user-1",
        customer: "cus_existing",
        line_items: [{ price: "price_pro_test", quantity: 1 }],
      }),
    );
    // Should NOT pass customer_email when reusing existing customer
    expect(mockCreateSession).not.toHaveBeenCalledWith(
      expect.objectContaining({ customer_email: expect.any(String) }),
    );
  });
});
