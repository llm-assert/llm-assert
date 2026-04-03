import Stripe from "stripe";
import { POST } from "../route";

// ---------------------------------------------------------------------------
// Mocks — vi.mock factories are hoisted, so they CANNOT reference top-level
// variables. All values must be inlined or use vi.hoisted().
// ---------------------------------------------------------------------------

const { WEBHOOK_SECRET, mockInsert, mockUpsert, mockUpdate, mockEq } =
  vi.hoisted(() => ({
    WEBHOOK_SECRET: "whsec_test_secret_for_unit_tests",
    mockInsert: vi.fn(),
    mockUpsert: vi.fn(),
    mockUpdate: vi.fn(),
    mockEq: vi.fn(),
  }));

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    from: (table: string) => {
      if (table === "stripe_webhook_events") {
        return { insert: mockInsert };
      }
      return {
        upsert: mockUpsert,
        update: mockUpdate,
      };
    },
  }),
}));

vi.mock("@/lib/stripe", async () => {
  const StripeMod = await vi.importActual<typeof import("stripe")>("stripe");
  const _stripe = new StripeMod.default("sk_test_fake_key_for_unit_tests");
  return {
    stripe: {
      webhooks: {
        constructEvent: (body: string, sig: string, secret: string) =>
          _stripe.webhooks.constructEvent(body, sig, secret),
      },
      subscriptions: {
        retrieve: vi.fn().mockResolvedValue({
          items: {
            data: [{ price: { id: "price_starter_test" } }],
          },
        }),
      },
    },
  };
});

vi.mock("@/lib/env.server", () => ({
  serverEnv: {
    STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET,
    STRIPE_STARTER_PRICE_ID: "price_starter_test",
    STRIPE_PRO_PRICE_ID: "price_pro_test",
    STRIPE_TEAM_PRICE_ID: "price_team_test",
  },
}));

// ---------------------------------------------------------------------------
// Test signing helper
// ---------------------------------------------------------------------------

function signPayload(payload: string): string {
  return Stripe.webhooks.generateTestHeaderString({
    payload,
    secret: WEBHOOK_SECRET,
  });
}

function makeRequest(body: string, signature?: string): Request {
  return new Request("http://localhost:3000/api/webhooks/stripe", {
    method: "POST",
    body,
    headers: {
      "stripe-signature": signature ?? signPayload(body),
      "content-type": "application/json",
    },
  });
}

function resetDbMocks() {
  mockInsert.mockReset().mockResolvedValue({ error: null });
  mockUpsert.mockReset().mockResolvedValue({ error: null });
  mockUpdate.mockReset().mockReturnValue({ eq: mockEq });
  mockEq.mockReset().mockResolvedValue({ error: null });
}

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

function buildEvent(
  type: string,
  object: Record<string, unknown>,
  overrides?: Partial<{ id: string }>,
): string {
  return JSON.stringify({
    id: overrides?.id ?? `evt_test_${Date.now()}`,
    object: "event",
    type,
    data: { object },
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  resetDbMocks();
});

describe("POST /api/webhooks/stripe", () => {
  describe("guard checks", () => {
    it("returns 503 when Stripe client is undefined", async () => {
      // Temporarily set stripe to undefined
      const mod = await import("@/lib/stripe");
      const descriptor = Object.getOwnPropertyDescriptor(mod, "stripe");
      Object.defineProperty(mod, "stripe", {
        value: undefined,
        writable: true,
        configurable: true,
      });

      const res = await POST(makeRequest("{}"));
      expect(res.status).toBe(503);

      // Restore
      Object.defineProperty(mod, "stripe", descriptor!);
    });

    it("returns 503 when webhook secret is undefined", async () => {
      const mod = await import("@/lib/env.server");
      const original = mod.serverEnv.STRIPE_WEBHOOK_SECRET;
      Object.defineProperty(mod.serverEnv, "STRIPE_WEBHOOK_SECRET", {
        value: undefined,
        configurable: true,
      });

      const res = await POST(makeRequest("{}"));
      expect(res.status).toBe(503);

      Object.defineProperty(mod.serverEnv, "STRIPE_WEBHOOK_SECRET", {
        value: original,
        configurable: true,
      });
    });
  });

  describe("signature verification", () => {
    it("returns 400 for invalid signature", async () => {
      const body = buildEvent("charge.succeeded", {});
      const req = makeRequest(body, "invalid_signature_header");
      const res = await POST(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe("Invalid signature");
    });

    it("passes raw body string to constructEvent, not re-serialized JSON", async () => {
      // Body with specific whitespace that JSON.parse + JSON.stringify would change
      const rawBody = buildEvent("charge.succeeded", {});
      const req = makeRequest(rawBody);
      const res = await POST(req);
      // If the handler re-serialized, the signature would fail (400).
      // Getting 200 proves it used the raw string.
      expect(res.status).toBe(200);
    });
  });

  describe("idempotency", () => {
    it("returns 200 without re-processing on duplicate event", async () => {
      mockInsert.mockResolvedValue({
        error: { code: "23505", message: "duplicate key" },
      });

      const body = buildEvent("customer.subscription.updated", {
        customer: "cus_123",
        items: { data: [{ price: { id: "price_starter_test" } }] },
        status: "active",
      });
      const res = await POST(makeRequest(body));

      expect(res.status).toBe(200);
      expect(mockUpsert).not.toHaveBeenCalled();
      expect(mockUpdate).not.toHaveBeenCalled();
    });
  });

  describe("event handlers", () => {
    it("upserts subscription on checkout.session.completed", async () => {
      const body = buildEvent("checkout.session.completed", {
        mode: "subscription",
        client_reference_id: "user-uuid-123",
        customer: "cus_123",
        subscription: "sub_123",
      });

      const res = await POST(makeRequest(body));
      expect(res.status).toBe(200);
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: "user-uuid-123",
          stripe_customer_id: "cus_123",
          stripe_subscription_id: "sub_123",
          status: "active",
        }),
        { onConflict: "stripe_customer_id" },
      );
    });

    it("skips checkout.session.completed without client_reference_id", async () => {
      const body = buildEvent("checkout.session.completed", {
        mode: "subscription",
        customer: "cus_123",
        subscription: "sub_123",
      });

      const res = await POST(makeRequest(body));
      expect(res.status).toBe(200);
      expect(mockUpsert).not.toHaveBeenCalled();
    });

    it("syncs plan, status, period dates, and evaluation limit on subscription.updated", async () => {
      const periodStart = Math.floor(Date.now() / 1000);
      const periodEnd = periodStart + 30 * 24 * 60 * 60;
      const body = buildEvent("customer.subscription.updated", {
        customer: "cus_updated",
        status: "active",
        items: {
          data: [
            {
              price: { id: "price_pro_test" },
              current_period_start: periodStart,
              current_period_end: periodEnd,
            },
          ],
        },
      });

      const res = await POST(makeRequest(body));
      expect(res.status).toBe(200);
      expect(mockUpdate).toHaveBeenCalledWith({
        plan: "pro",
        status: "active",
        current_period_start: new Date(periodStart * 1000).toISOString(),
        current_period_end: new Date(periodEnd * 1000).toISOString(),
        evaluation_limit: 25000,
      });
      expect(mockEq).toHaveBeenCalledWith("stripe_customer_id", "cus_updated");
    });

    it("updates status to canceled and clears period end on subscription.deleted", async () => {
      const body = buildEvent("customer.subscription.deleted", {
        customer: "cus_123",
      });

      const res = await POST(makeRequest(body));
      expect(res.status).toBe(200);
      expect(mockUpdate).toHaveBeenCalledWith({
        status: "canceled",
        current_period_end: null,
      });
      expect(mockEq).toHaveBeenCalledWith("stripe_customer_id", "cus_123");
    });

    it("updates status to past_due on invoice.payment_failed", async () => {
      const body = buildEvent("invoice.payment_failed", {
        customer: "cus_456",
      });

      const res = await POST(makeRequest(body));
      expect(res.status).toBe(200);
      expect(mockUpdate).toHaveBeenCalledWith({ status: "past_due" });
      expect(mockEq).toHaveBeenCalledWith("stripe_customer_id", "cus_456");
    });

    it("updates status to active and resets evaluations_used on invoice.paid", async () => {
      const body = buildEvent("invoice.paid", { customer: "cus_789" });

      const res = await POST(makeRequest(body));
      expect(res.status).toBe(200);
      expect(mockUpdate).toHaveBeenCalledWith({
        status: "active",
        evaluations_used: 0,
      });
      expect(mockEq).toHaveBeenCalledWith("stripe_customer_id", "cus_789");
    });

    it("returns 200 with no DB writes for unrecognized event type", async () => {
      const body = buildEvent("charge.succeeded", { id: "ch_123" });

      const res = await POST(makeRequest(body));
      expect(res.status).toBe(200);
      expect(mockUpsert).not.toHaveBeenCalled();
      expect(mockUpdate).not.toHaveBeenCalled();
    });
  });

  describe("error handling", () => {
    it("returns 500 when Supabase write fails", async () => {
      mockUpsert.mockResolvedValue({
        error: { code: "42501", message: "permission denied" },
      });

      const body = buildEvent("checkout.session.completed", {
        mode: "subscription",
        client_reference_id: "user-uuid-123",
        customer: "cus_123",
        subscription: "sub_123",
      });

      const res = await POST(makeRequest(body));
      expect(res.status).toBe(500);
    });
  });
});
