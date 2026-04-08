import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidateTag } from "next/cache";
import { stripe } from "@/lib/stripe";
import { serverEnv } from "@/lib/env.server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { planFromPriceId, PLANS } from "@/lib/plans";

export const maxDuration = 30;

export async function POST(request: Request): Promise<Response> {
  // Guard: Stripe client must be configured
  if (!stripe) {
    return Response.json({ error: "Stripe not configured" }, { status: 503 });
  }

  // Guard: Webhook secret must be configured
  const webhookSecret = serverEnv.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return Response.json(
      { error: "Webhook secret not configured" },
      { status: 503 },
    );
  }

  // Read raw body for signature verification — MUST use request.text(), not request.json()
  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature") ?? "";

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    logWebhook(
      "signature_verification_failed",
      "unknown",
      "constructEvent",
      `${err instanceof Error ? err.message : "Unknown error"} (secret fingerprint: ...${webhookSecret.slice(-8)})`,
    );
    return Response.json({ error: "Invalid signature" }, { status: 400 });
  }

  // Dedup is handled atomically inside the record_plan_transition RPC
  const db = supabaseAdmin();

  // Dispatch by event type
  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object, event.id, db);
        break;
      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event.data.object, event.id, db);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object, event.id, db);
        break;
      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(event.data.object, event.id, db);
        break;
      case "invoice.paid":
        await handleInvoicePaid(event.data.object, event.id, db);
        break;
      default:
        // Acknowledge unrecognized events without processing
        break;
    }
  } catch (error) {
    // Avoid double-logging errors already logged by inner handlers (e.g. resolvePlanFromSubscription)
    if (!(error instanceof Error && loggedErrors.has(error))) {
      logWebhook(
        "processing_error",
        event.id,
        event.type,
        error instanceof Error ? error.message : String(error),
      );
    }
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }

  return Response.json({ received: true });
}

// ---------------------------------------------------------------------------
// Pre-read helper: fetch current subscription state before RPC
// ---------------------------------------------------------------------------

type CurrentSubscription = {
  user_id: string;
  plan: string;
  status: string;
};

/** Read current subscription row by user_id or stripe_customer_id. Returns null for new users. */
async function getCurrentSubscription(
  db: SupabaseClient,
  options: { userId?: string; customerId?: string },
): Promise<CurrentSubscription | null> {
  if (options.userId) {
    const { data } = await db
      .from("subscriptions")
      .select("user_id, plan, status")
      .eq("user_id", options.userId)
      .maybeSingle();
    return data;
  }
  if (options.customerId) {
    const { data } = await db
      .from("subscriptions")
      .select("user_id, plan, status")
      .eq("stripe_customer_id", options.customerId)
      .maybeSingle();
    return data;
  }
  return null;
}

// ---------------------------------------------------------------------------
// RPC call helper with audit logging
// ---------------------------------------------------------------------------

async function callTransitionRPC(
  db: SupabaseClient,
  params: Record<string, unknown>,
  stripeEventId: string,
  eventType: string,
): Promise<"ok" | "duplicate"> {
  const { data, error } = await db.rpc("record_plan_transition", params);
  if (error) throw error;
  if (data === "duplicate") {
    logWebhook("duplicate_skipped", stripeEventId, eventType);
    return "duplicate";
  }
  logWebhook("processed", stripeEventId, eventType, undefined, true);
  return "ok";
}

// ---------------------------------------------------------------------------
// Event handlers
// ---------------------------------------------------------------------------

async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session,
  stripeEventId: string,
  db: SupabaseClient,
): Promise<void> {
  if (session.mode !== "subscription") return;

  const userId = session.client_reference_id;
  if (!userId) {
    logWebhook(
      "missing_client_reference_id",
      session.id ?? "unknown",
      "checkout.session.completed",
    );
    return;
  }

  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer?.id;
  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id;

  if (!customerId) return;

  // Resolve plan from the subscription's price
  const plan = await resolvePlanFromSubscription(subscriptionId);

  if (!plan && subscriptionId) {
    logWebhook(
      "unknown_price_id",
      session.id ?? "unknown",
      "checkout.session.completed",
      `planFromPriceId returned null for subscription ${subscriptionId} — defaulting to starter`,
    );
  }

  // Pre-read current subscription for audit trail
  const current = await getCurrentSubscription(db, { userId });
  const newPlan = plan?.name ?? "starter";
  const newStatus = "active";

  const result = await callTransitionRPC(
    db,
    {
      p_user_id: userId,
      p_old_plan: current?.plan ?? null,
      p_new_plan: newPlan,
      p_old_status: current?.status ?? null,
      p_new_status: newStatus,
      p_reason: "checkout_completed",
      p_stripe_event_id: stripeEventId,
      p_metadata: {
        evaluation_limit: plan?.evaluationLimit ?? 5_000,
        project_limit: plan?.projectsLimit ?? 1,
      },
      p_stripe_customer_id: customerId,
      p_stripe_subscription_id: subscriptionId ?? null,
      p_plan: newPlan,
      p_status: newStatus,
      p_evaluation_limit: plan?.evaluationLimit ?? 5_000,
      p_project_limit: plan?.projectsLimit ?? 1,
      p_event_type: "checkout.session.completed",
    },
    stripeEventId,
    "checkout.session.completed",
  );

  if (result === "duplicate") return;
  revalidateTag(`subscription-${userId}`, "max");
}

async function handleSubscriptionUpdated(
  subscription: Stripe.Subscription,
  stripeEventId: string,
  db: SupabaseClient,
): Promise<void> {
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer?.id;
  if (!customerId) return;

  // Resolve plan from current price — period dates live on subscription items in Stripe SDK v21
  const firstItem = subscription.items.data[0];
  const priceId = firstItem?.price.id;
  const plan = priceId ? planFromPriceId(priceId) : null;

  if (!plan && priceId) {
    logWebhook(
      "unknown_price_id",
      typeof subscription.id === "string" ? subscription.id : "unknown",
      "customer.subscription.updated",
      `planFromPriceId returned null for price ${priceId} — defaulting to starter`,
    );
  }

  // Pre-read current subscription for audit trail
  const current = await getCurrentSubscription(db, { customerId });
  if (!current) return;

  const newPlan = plan?.name ?? "starter";
  const newStatus = subscription.status;
  const periodStart = firstItem?.current_period_start
    ? new Date(firstItem.current_period_start * 1000).toISOString()
    : null;
  const periodEnd = firstItem?.current_period_end
    ? new Date(firstItem.current_period_end * 1000).toISOString()
    : null;

  const result = await callTransitionRPC(
    db,
    {
      p_user_id: current.user_id,
      p_old_plan: current.plan,
      p_new_plan: newPlan,
      p_old_status: current.status,
      p_new_status: newStatus,
      p_reason: "subscription_updated",
      p_stripe_event_id: stripeEventId,
      p_metadata: {
        evaluation_limit: plan?.evaluationLimit ?? 5_000,
        project_limit: plan?.projectsLimit ?? 1,
        current_period_start: periodStart,
        current_period_end: periodEnd,
        cancel_at_period_end: subscription.cancel_at_period_end ?? false,
      },
      p_plan: newPlan,
      p_status: newStatus,
      p_current_period_start: periodStart,
      p_current_period_end: periodEnd,
      p_evaluation_limit: plan?.evaluationLimit ?? 5_000,
      p_project_limit: plan?.projectsLimit ?? 1,
      p_cancel_at_period_end: subscription.cancel_at_period_end ?? false,
      p_event_type: "customer.subscription.updated",
    },
    stripeEventId,
    "customer.subscription.updated",
  );

  if (result === "duplicate") return;
  revalidateTag(`subscription-${current.user_id}`, "max");
}

async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription,
  stripeEventId: string,
  db: SupabaseClient,
): Promise<void> {
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer?.id;
  if (!customerId) return;

  // Pre-read current subscription for audit trail
  const current = await getCurrentSubscription(db, { customerId });
  if (!current) return;

  const result = await callTransitionRPC(
    db,
    {
      p_user_id: current.user_id,
      p_old_plan: current.plan,
      p_new_plan: "free",
      p_old_status: current.status,
      p_new_status: "active",
      p_reason: "subscription_deleted",
      p_stripe_event_id: stripeEventId,
      p_metadata: {
        evaluation_limit: PLANS.free.evaluationLimit,
        project_limit: PLANS.free.projectsLimit,
      },
      p_plan: "free",
      p_status: "active",
      p_evaluation_limit: PLANS.free.evaluationLimit,
      p_project_limit: PLANS.free.projectsLimit,
      p_evaluations_used: 0,
      p_last_evaluations_reset_at: new Date().toISOString(),
      p_current_period_end: null,
      p_event_type: "customer.subscription.deleted",
    },
    stripeEventId,
    "customer.subscription.deleted",
  );

  if (result === "duplicate") return;
  revalidateTag(`subscription-${current.user_id}`, "max");
}

async function handleInvoicePaymentFailed(
  invoice: Stripe.Invoice,
  stripeEventId: string,
  db: SupabaseClient,
): Promise<void> {
  const customerId =
    typeof invoice.customer === "string"
      ? invoice.customer
      : invoice.customer?.id;
  if (!customerId) return;

  // Pre-read current subscription for audit trail
  const current = await getCurrentSubscription(db, { customerId });
  if (!current) return;

  const result = await callTransitionRPC(
    db,
    {
      p_user_id: current.user_id,
      p_old_plan: current.plan,
      p_new_plan: current.plan,
      p_old_status: current.status,
      p_new_status: "past_due",
      p_reason: "payment_failed",
      p_stripe_event_id: stripeEventId,
      p_metadata: null,
      p_status: "past_due",
      p_event_type: "invoice.payment_failed",
    },
    stripeEventId,
    "invoice.payment_failed",
  );

  if (result === "duplicate") return;
  revalidateTag(`subscription-${current.user_id}`, "max");
}

async function handleInvoicePaid(
  invoice: Stripe.Invoice,
  stripeEventId: string,
  db: SupabaseClient,
): Promise<void> {
  const customerId =
    typeof invoice.customer === "string"
      ? invoice.customer
      : invoice.customer?.id;
  if (!customerId) return;

  // Pre-read current subscription for audit trail
  const current = await getCurrentSubscription(db, { customerId });
  if (!current) return;

  const result = await callTransitionRPC(
    db,
    {
      p_user_id: current.user_id,
      p_old_plan: current.plan,
      p_new_plan: current.plan,
      p_old_status: current.status,
      p_new_status: "active",
      p_reason: "payment_recovered",
      p_stripe_event_id: stripeEventId,
      p_metadata: null,
      p_status: "active",
      p_evaluations_used: 0,
      p_last_evaluations_reset_at: new Date().toISOString(),
      p_event_type: "invoice.paid",
    },
    stripeEventId,
    "invoice.paid",
  );

  if (result === "duplicate") return;
  revalidateTag(`subscription-${current.user_id}`, "max");
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Track errors already logged by inner handlers to avoid double-logging in outer catch */
const loggedErrors = new WeakSet<Error>();

function logWebhook(
  event: string,
  stripeId: string,
  type: string,
  error?: string,
  auditWritten?: boolean,
): void {
  const entry = {
    source: "stripe-webhook",
    event,
    stripeId,
    type,
    ...(error && { error }),
    ...(auditWritten !== undefined && { auditWritten }),
  };
  if (error) {
    console.error(JSON.stringify(entry));
  } else {
    console.log(JSON.stringify(entry));
  }
}

async function resolvePlanFromSubscription(
  subscriptionId: string | undefined | null,
) {
  if (!subscriptionId || !stripe) return null;
  try {
    const sub = await stripe.subscriptions.retrieve(subscriptionId);
    const priceId = sub.items.data[0]?.price.id;
    return priceId ? planFromPriceId(priceId) : null;
  } catch (err) {
    logWebhook(
      "resolve_plan_error",
      subscriptionId,
      "subscription.retrieve",
      err instanceof Error ? err.message : "Unknown error",
    );
    if (err instanceof Error) loggedErrors.add(err);
    throw err;
  }
}
