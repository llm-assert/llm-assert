import { createClient } from "@/lib/supabase/server";
import { PLANS } from "@/lib/plans";
import type { PlanName } from "@/lib/plans.client";
import { getPlanDisplay } from "@/lib/plans.client";
import { SubscriptionStatus } from "@/components/billing/subscription-status";
import { UsageMeter } from "@/components/billing/usage-meter";
import { PlanCards } from "@/components/billing/plan-cards";
import { CheckoutSuccessBanner } from "@/components/billing/checkout-success-banner";
import { PastDueBanner } from "@/components/billing/past-due-banner";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const showCheckoutSuccess = params.checkout === "success";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  // Fetch subscription — may be null for free-tier users
  const { data: subscription } = await supabase
    .from("subscriptions")
    .select(
      "plan, status, evaluations_used, evaluation_limit, current_period_end",
    )
    .eq("user_id", user.id)
    .maybeSingle();

  const currentPlan = (subscription?.plan ?? "free") as PlanName;
  const planDisplay = getPlanDisplay(currentPlan);
  const evaluationsUsed = subscription?.evaluations_used ?? 0;
  const evaluationLimit =
    subscription?.evaluation_limit ?? planDisplay.evaluationLimit;
  const subscriptionStatus = (subscription?.status ?? null) as
    | "active"
    | "past_due"
    | "canceled"
    | null;

  // Build plan card data with priceIds from server-only PLANS config
  // Replace Infinity with -1 for JSON serialization across RSC boundary
  const planCardData = Object.values(PLANS).map((plan) => ({
    name: plan.name,
    label: plan.label,
    evaluationLimit: plan.evaluationLimit,
    projectsLimit: Number.isFinite(plan.projectsLimit)
      ? plan.projectsLimit
      : -1,
    priceId: plan.priceId,
  }));

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <h1 className="text-2xl font-semibold">Billing</h1>

      {showCheckoutSuccess && <CheckoutSuccessBanner show />}
      {subscriptionStatus === "past_due" && <PastDueBanner />}

      <Card>
        <CardHeader>
          <CardTitle>Current Plan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <SubscriptionStatus
            subscription={
              subscription
                ? {
                    plan: currentPlan,
                    status: subscriptionStatus!,
                    currentPeriodEnd: subscription.current_period_end,
                  }
                : null
            }
          />
          <Separator />
          <UsageMeter used={evaluationsUsed} limit={evaluationLimit} />
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h2 className="text-lg font-medium">Plans</h2>
        <p className="text-sm text-muted-foreground">
          Each evaluation is one assertion check (e.g., a single{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">
            toBeGrounded()
          </code>{" "}
          call). A test run with 10 assertions uses 10 evaluations.
        </p>
        <PlanCards
          plans={planCardData}
          currentPlan={currentPlan}
          subscriptionStatus={subscriptionStatus}
        />
      </div>
    </div>
  );
}
