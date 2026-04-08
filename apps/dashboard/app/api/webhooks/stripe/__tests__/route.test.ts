import Stripe from "stripe";
import { POST } from "../route";

// ---------------------------------------------------------------------------
// Mocks — vi.mock factories are hoisted, so they CANNOT reference top-level
// variables. All values must be inlined or use vi.hoisted().
// ---------------------------------------------------------------------------

const { WEBHOOK_SECRET, mockRpc, mockSubscriptionSelect } = vi.hoisted(() => ({
  WEBHOOK_SECRET: "whsec_test_secret_for_unit_tests",
  mockRpc: vi.fn(),
  mockSubscriptionSelect: vi.fn(),
}));

/** Default pre-read subscription state for tests */
const DEFAULT_CURRENT_SUBSCRIPTION = {
  user_id: "test-user-id",
  plan: "starter",
  status: "active",
};

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    from: (table: string) => {
      if (table === "subscriptions") {
        return {
          select: mockSubscriptionSelect,
        };
      }
      return {};
    },
    rpc: mockRpc,
  }),
}));

vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
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

vi.mock("@/lib/plans", () => ({
  PLANS: {
    free: {
      name: "free",
      label: "Free",
      evaluationLimit: 100,
      projectsLimit: 1,
      priceId: null,
    },
  },
  planFromPriceId: (priceId: string) => {
    const plans: Record<
      string,
      { name: string; evaluationLimit: number; projectsLimit: number }
    > = {
      price_starter_test: {
        name: "starter",
        evaluationLimit: 5000,
        projectsLimit: 3,
      },
      price_pro_test: {
        name: "pro",
        evaluationLimit: 25000,
        projectsLimit: 10,
      },
      price_team_test: {
        name: "team",
        evaluationLimit: 100000,
        projectsLimit: -1,
      },
    };
    return plans[priceId] ?? null;
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

/** Set up the pre-read SELECT mock chain: .select().eq().maybeSingle() */
function mockPreRead(data: Record<string, unknown> | null) {
  mockSubscriptionSelect.mockReturnValue({
    eq: vi.fn().mockReturnValue({
      maybeSingle: vi.fn().mockResolvedValue({ data }),
    }),
  });
}

function resetDbMocks() {
  mockRpc.mockReset().mockResolvedValue({ data: "ok", error: null });
  mockPreRead(DEFAULT_CURRENT_SUBSCRIPTION);
}

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
  vi.clearAllMocks();
  resetDbMocks();
});

describe("POST /api/webhooks/stripe", () => {
  describe("guard checks", () => {
    it("returns 503 when Stripe client is undefined", async () => {
      const mod = await import("@/lib/stripe");
      const descriptor = Object.getOwnPropertyDescriptor(mod, "stripe");
      Object.defineProperty(mod, "stripe", {
        value: undefined,
        writable: true,
        configurable: true,
      });

      const res = await POST(makeRequest("{}"));
      expect(res.status).toBe(503);

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
      const rawBody = buildEvent("charge.succeeded", {});
      const req = makeRequest(rawBody);
      const res = await POST(req);
      expect(res.status).toBe(200);
    });
  });

  describe("idempotency (atomic dedup via RPC)", () => {
    it("returns 200 and skips revalidateTag when RPC returns duplicate", async () => {
      const { revalidateTag } = await import("next/cache");
      mockRpc.mockResolvedValue({ data: "duplicate", error: null });

      const body = buildEvent("customer.subscription.updated", {
        customer: "cus_123",
        items: { data: [{ price: { id: "price_starter_test" } }] },
        status: "active",
      });
      const res = await POST(makeRequest(body));

      expect(res.status).toBe(200);
      expect(mockRpc).toHaveBeenCalledTimes(1);
      expect(revalidateTag).not.toHaveBeenCalled();
    });

    it("returns 200 and skips revalidateTag on duplicate cancellation event", async () => {
      const { revalidateTag } = await import("next/cache");
      mockRpc.mockResolvedValue({ data: "duplicate", error: null });

      const body = buildEvent("customer.subscription.updated", {
        customer: "cus_cancel_dup",
        cancel_at_period_end: true,
        items: { data: [{ price: { id: "price_pro_test" } }] },
        status: "active",
      });
      const res = await POST(makeRequest(body));

      expect(res.status).toBe(200);
      expect(mockRpc).toHaveBeenCalledTimes(1);
      expect(revalidateTag).not.toHaveBeenCalled();
    });

    it("logs duplicate_skipped when RPC returns duplicate", async () => {
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      mockRpc.mockResolvedValue({ data: "duplicate", error: null });

      const body = buildEvent("customer.subscription.deleted", {
        customer: "cus_dup_log",
      });
      await POST(makeRequest(body));

      const logged = logSpy.mock.calls.find(
        (call) =>
          typeof call[0] === "string" && call[0].includes("duplicate_skipped"),
      );
      expect(logged).toBeDefined();

      logSpy.mockRestore();
    });
  });

  describe("event handlers with audit trail", () => {
    it("checkout.session.completed — calls RPC with correct old/new plan and reason", async () => {
      // Pre-read returns free tier (user upgrading)
      mockPreRead({ user_id: "user-uuid-123", plan: "free", status: "active" });

      const body = buildEvent("checkout.session.completed", {
        mode: "subscription",
        client_reference_id: "user-uuid-123",
        customer: "cus_123",
        subscription: "sub_123",
      });

      const res = await POST(makeRequest(body));
      expect(res.status).toBe(200);
      expect(mockRpc).toHaveBeenCalledWith(
        "record_plan_transition",
        expect.objectContaining({
          p_user_id: "user-uuid-123",
          p_old_plan: "free",
          p_new_plan: "starter",
          p_old_status: "active",
          p_new_status: "active",
          p_reason: "checkout_completed",
          p_stripe_event_id: expect.stringContaining("evt_test_"),
          p_plan: "starter",
          p_evaluation_limit: 5000,
          p_project_limit: 3,
          p_event_type: "checkout.session.completed",
        }),
      );
    });

    it("checkout.session.completed — null old_plan for new user (pre-read returns null)", async () => {
      mockPreRead(null);

      const body = buildEvent("checkout.session.completed", {
        mode: "subscription",
        client_reference_id: "new-user-id",
        customer: "cus_new",
        subscription: "sub_new",
      });

      const res = await POST(makeRequest(body));
      expect(res.status).toBe(200);
      expect(mockRpc).toHaveBeenCalledWith(
        "record_plan_transition",
        expect.objectContaining({
          p_user_id: "new-user-id",
          p_old_plan: null,
          p_new_plan: "starter",
          p_old_status: null,
          p_new_status: "active",
          p_reason: "checkout_completed",
        }),
      );
    });

    it("customer.subscription.updated with plan change — RPC called with old != new plan", async () => {
      mockPreRead({
        user_id: "test-user-id",
        plan: "starter",
        status: "active",
      });

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
      expect(mockRpc).toHaveBeenCalledWith(
        "record_plan_transition",
        expect.objectContaining({
          p_old_plan: "starter",
          p_new_plan: "pro",
          p_old_status: "active",
          p_new_status: "active",
          p_reason: "subscription_updated",
          p_evaluation_limit: 25000,
          p_project_limit: 10,
          p_event_type: "customer.subscription.updated",
        }),
      );
    });

    it("customer.subscription.updated with cancel_at_period_end=true — RPC called with p_cancel_at_period_end=true", async () => {
      mockPreRead({
        user_id: "test-user-id",
        plan: "pro",
        status: "active",
      });

      const periodEnd = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
      const body = buildEvent("customer.subscription.updated", {
        customer: "cus_canceling",
        status: "active",
        cancel_at_period_end: true,
        items: {
          data: [
            {
              price: { id: "price_pro_test" },
              current_period_end: periodEnd,
            },
          ],
        },
      });

      const res = await POST(makeRequest(body));
      expect(res.status).toBe(200);
      expect(mockRpc).toHaveBeenCalledWith(
        "record_plan_transition",
        expect.objectContaining({
          p_old_plan: "pro",
          p_new_plan: "pro",
          p_old_status: "active",
          p_new_status: "active",
          p_reason: "subscription_updated",
          p_cancel_at_period_end: true,
        }),
      );
    });

    it("customer.subscription.updated with cancel_at_period_end=false (reactivation) — RPC called with p_cancel_at_period_end=false", async () => {
      mockPreRead({
        user_id: "test-user-id",
        plan: "pro",
        status: "active",
      });

      const body = buildEvent("customer.subscription.updated", {
        customer: "cus_reactivated",
        status: "active",
        cancel_at_period_end: false,
        items: {
          data: [{ price: { id: "price_pro_test" } }],
        },
      });

      const res = await POST(makeRequest(body));
      expect(res.status).toBe(200);
      expect(mockRpc).toHaveBeenCalledWith(
        "record_plan_transition",
        expect.objectContaining({
          p_cancel_at_period_end: false,
        }),
      );
    });

    it("customer.subscription.updated without plan change — RPC called but no audit row (handled by DB)", async () => {
      // Pre-read returns same plan as update
      mockPreRead({ user_id: "test-user-id", plan: "pro", status: "active" });

      const body = buildEvent("customer.subscription.updated", {
        customer: "cus_same_plan",
        status: "active",
        items: {
          data: [{ price: { id: "price_pro_test" } }],
        },
      });

      const res = await POST(makeRequest(body));
      expect(res.status).toBe(200);
      // RPC is still called — the IS DISTINCT FROM check in the DB handles the no-op
      expect(mockRpc).toHaveBeenCalledWith(
        "record_plan_transition",
        expect.objectContaining({
          p_old_plan: "pro",
          p_new_plan: "pro",
          p_old_status: "active",
          p_new_status: "active",
        }),
      );
    });

    it("customer.subscription.deleted — RPC called with new_plan = free", async () => {
      mockPreRead({ user_id: "test-user-id", plan: "pro", status: "active" });

      const body = buildEvent("customer.subscription.deleted", {
        customer: "cus_123",
      });

      const res = await POST(makeRequest(body));
      expect(res.status).toBe(200);
      expect(mockRpc).toHaveBeenCalledWith(
        "record_plan_transition",
        expect.objectContaining({
          p_old_plan: "pro",
          p_new_plan: "free",
          p_old_status: "active",
          p_new_status: "active",
          p_reason: "subscription_deleted",
          p_evaluation_limit: 100,
          p_project_limit: 1,
          p_evaluations_used: 0,
          p_event_type: "customer.subscription.deleted",
        }),
      );
    });

    it("invoice.payment_failed — RPC called with new_status = past_due", async () => {
      mockPreRead({ user_id: "test-user-id", plan: "pro", status: "active" });

      const body = buildEvent("invoice.payment_failed", {
        customer: "cus_456",
      });

      const res = await POST(makeRequest(body));
      expect(res.status).toBe(200);
      expect(mockRpc).toHaveBeenCalledWith(
        "record_plan_transition",
        expect.objectContaining({
          p_old_plan: "pro",
          p_new_plan: "pro",
          p_old_status: "active",
          p_new_status: "past_due",
          p_reason: "payment_failed",
          p_status: "past_due",
          p_event_type: "invoice.payment_failed",
        }),
      );
    });

    it("invoice.paid — RPC called with new_status = active and evaluations reset", async () => {
      mockPreRead({ user_id: "test-user-id", plan: "pro", status: "past_due" });

      const body = buildEvent("invoice.paid", { customer: "cus_789" });

      const res = await POST(makeRequest(body));
      expect(res.status).toBe(200);
      expect(mockRpc).toHaveBeenCalledWith(
        "record_plan_transition",
        expect.objectContaining({
          p_old_plan: "pro",
          p_new_plan: "pro",
          p_old_status: "past_due",
          p_new_status: "active",
          p_reason: "payment_recovered",
          p_evaluations_used: 0,
          p_last_evaluations_reset_at: expect.any(String),
          p_event_type: "invoice.paid",
        }),
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
      expect(mockRpc).not.toHaveBeenCalled();
    });

    it("returns 200 with no RPC calls for unrecognized event type", async () => {
      const body = buildEvent("charge.succeeded", { id: "ch_123" });

      const res = await POST(makeRequest(body));
      expect(res.status).toBe(200);
      expect(mockRpc).not.toHaveBeenCalled();
    });
  });

  describe("RPC failure triggers Stripe retry", () => {
    it("returns 500 when RPC fails so Stripe retries the event", async () => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      mockRpc.mockResolvedValue({
        error: { code: "42501", message: "permission denied" },
      });

      const body = buildEvent("customer.subscription.deleted", {
        customer: "cus_rpc_fail",
      });

      const res = await POST(makeRequest(body));
      expect(res.status).toBe(500);

      const logged = errorSpy.mock.calls.find(
        (call) =>
          typeof call[0] === "string" && call[0].includes("processing_error"),
      );
      expect(logged).toBeDefined();

      errorSpy.mockRestore();
    });
  });

  describe("error handling", () => {
    it("returns 500 and logs error when Stripe API fails during plan resolution", async () => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const stripeMod = await import("@/lib/stripe");
      const mockRetrieve = (
        stripeMod.stripe!.subscriptions as {
          retrieve: ReturnType<typeof vi.fn>;
        }
      ).retrieve;
      mockRetrieve.mockRejectedValueOnce(new Error("Stripe rate limited"));

      const body = buildEvent("checkout.session.completed", {
        mode: "subscription",
        client_reference_id: "user-uuid-123",
        customer: "cus_123",
        subscription: "sub_fail",
      });

      const res = await POST(makeRequest(body));
      expect(res.status).toBe(500);
      expect(mockRpc).not.toHaveBeenCalled();

      const logged = errorSpy.mock.calls.find(
        (call) =>
          typeof call[0] === "string" && call[0].includes("resolve_plan_error"),
      );
      expect(logged).toBeDefined();
      expect(logged![0]).toContain("sub_fail");
      expect(logged![0]).toContain("Stripe rate limited");

      errorSpy.mockRestore();
    });

    it("logs secret fingerprint on signature verification failure", async () => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const body = buildEvent("charge.succeeded", {});
      const req = makeRequest(body, "invalid_signature_header");

      await POST(req);

      const logged = errorSpy.mock.calls.find(
        (call) =>
          typeof call[0] === "string" &&
          call[0].includes("signature_verification_failed"),
      );
      expect(logged).toBeDefined();
      expect(logged![0]).toContain(WEBHOOK_SECRET.slice(-8));

      errorSpy.mockRestore();
    });
  });
});
