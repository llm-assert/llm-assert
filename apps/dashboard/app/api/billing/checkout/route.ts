import { stripe } from "@/lib/stripe";
import { planFromPriceId } from "@/lib/plans";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request): Promise<Response> {
  if (!stripe) {
    return Response.json({ error: "Stripe not configured" }, { status: 503 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Parse and validate priceId
  let priceId: string;
  try {
    const body = await request.json();
    priceId = body.priceId;
  } catch {
    return Response.json({ error: "Invalid price ID" }, { status: 400 });
  }

  if (!priceId || !planFromPriceId(priceId)) {
    return Response.json({ error: "Invalid price ID" }, { status: 400 });
  }

  // Check existing subscription
  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("stripe_customer_id, status")
    .eq("user_id", user.id)
    .single();

  if (subscription?.status === "active") {
    return Response.json(
      {
        error:
          "Active subscription exists. Use the billing portal to manage your plan.",
      },
      { status: 409 },
    );
  }

  // Build checkout session params — pin to server-side env var, not Origin header
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    client_reference_id: user.id,
    ...(subscription?.stripe_customer_id
      ? { customer: subscription.stripe_customer_id }
      : { customer_email: user.email }),
    success_url: `${appUrl}/settings/billing?checkout=success`,
    cancel_url: `${appUrl}/settings/billing`,
  });

  return Response.json({ url: session.url });
}
