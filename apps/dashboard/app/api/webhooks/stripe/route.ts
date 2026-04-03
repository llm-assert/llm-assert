import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { serverEnv } from "@/lib/env.server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { planFromPriceId } from "@/lib/plans";

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
  } catch {
    return Response.json({ error: "Invalid signature" }, { status: 400 });
  }

  // Idempotency: insert event ID, skip if already processed
  const db = supabaseAdmin();
  const { error: dedupError } = await db
    .from("stripe_webhook_events")
    .insert({ event_id: event.id, event_type: event.type });

  if (dedupError?.code === "23505") {
    // Duplicate key — event already processed
    return Response.json({ received: true });
  }
  if (dedupError) {
    logWebhook("dedup_error", event.id, event.type, dedupError.message);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }

  // Dispatch by event type
  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object, db);
        break;
      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event.data.object, db);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object, db);
        break;
      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(event.data.object, db);
        break;
      case "invoice.paid":
        await handleInvoicePaid(event.data.object, db);
        break;
      default:
        // Acknowledge unrecognized events without processing
        break;
    }
  } catch (error) {
    logWebhook(
      "processing_error",
      event.id,
      event.type,
      error instanceof Error ? error.message : String(error),
    );
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }

  return Response.json({ received: true });
}

// ---------------------------------------------------------------------------
// Event handlers
// ---------------------------------------------------------------------------

async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session,
  db: ReturnType<typeof supabaseAdmin>,
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

  const { error } = await db.from("subscriptions").upsert(
    {
      user_id: userId,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId ?? null,
      plan: plan?.name ?? "starter",
      status: "active",
      evaluation_limit: plan?.evaluationLimit ?? 5_000,
    },
    { onConflict: "stripe_customer_id" },
  );

  if (error) throw error;
}

async function handleSubscriptionUpdated(
  subscription: Stripe.Subscription,
  db: ReturnType<typeof supabaseAdmin>,
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

  const { error } = await db
    .from("subscriptions")
    .update({
      plan: plan?.name ?? "starter",
      status: subscription.status,
      current_period_start: firstItem?.current_period_start
        ? new Date(firstItem.current_period_start * 1000).toISOString()
        : null,
      current_period_end: firstItem?.current_period_end
        ? new Date(firstItem.current_period_end * 1000).toISOString()
        : null,
      evaluation_limit: plan?.evaluationLimit ?? 5_000,
    })
    .eq("stripe_customer_id", customerId);

  if (error) throw error;
}

async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription,
  db: ReturnType<typeof supabaseAdmin>,
): Promise<void> {
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer?.id;
  if (!customerId) return;

  const { error } = await db
    .from("subscriptions")
    .update({ status: "canceled", current_period_end: null })
    .eq("stripe_customer_id", customerId);

  if (error) throw error;
}

async function handleInvoicePaymentFailed(
  invoice: Stripe.Invoice,
  db: ReturnType<typeof supabaseAdmin>,
): Promise<void> {
  const customerId =
    typeof invoice.customer === "string"
      ? invoice.customer
      : invoice.customer?.id;
  if (!customerId) return;

  const { error } = await db
    .from("subscriptions")
    .update({ status: "past_due" })
    .eq("stripe_customer_id", customerId);

  if (error) throw error;
}

async function handleInvoicePaid(
  invoice: Stripe.Invoice,
  db: ReturnType<typeof supabaseAdmin>,
): Promise<void> {
  const customerId =
    typeof invoice.customer === "string"
      ? invoice.customer
      : invoice.customer?.id;
  if (!customerId) return;

  const { error } = await db
    .from("subscriptions")
    .update({ status: "active", evaluations_used: 0 })
    .eq("stripe_customer_id", customerId);

  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function logWebhook(
  event: string,
  stripeId: string,
  type: string,
  error?: string,
): void {
  const entry = {
    source: "stripe-webhook",
    event,
    stripeId,
    type,
    ...(error && { error }),
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
  } catch {
    return null;
  }
}
