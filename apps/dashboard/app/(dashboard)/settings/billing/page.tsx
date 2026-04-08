import { requireAuth } from "@/lib/queries/get-auth-user";
import { getSubscription } from "@/lib/supabase/queries/subscription";
import { getPlanTransitions } from "@/lib/supabase/queries/plan-transitions";
import { PLANS } from "@/lib/plans";
import type { PlanName } from "@/lib/plans.client";
import { getPlanDisplay, PLAN_DISPLAY } from "@/lib/plans.client";
import { SubscriptionStatus } from "@/components/billing/subscription-status";
import { UsageMeter } from "@/components/billing/usage-meter";
import { PlanCards } from "@/components/billing/plan-cards";
import { PlanTransitionHistory } from "@/components/billing/plan-transition-history";
import { CheckoutSuccessBanner } from "@/components/billing/checkout-success-banner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const showCheckoutSuccess = params.checkout === "success";

  const user = await requireAuth();

  // Use shared cached helper — deduplicated with layout's BillingAlertBanner fetch
  const [subscription, transitions] = await Promise.all([
    getSubscription(user.id),
    getPlanTransitions(user.id),
  ]);

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
  // Merge display fields from PLAN_DISPLAY with server-only priceId from PLANS
  // Replace Infinity with -1 for JSON serialization across RSC boundary
  const planCardData = Object.values(PLANS).map((plan) => {
    const display = PLAN_DISPLAY.find((d) => d.name === plan.name);
    return {
      name: plan.name,
      label: plan.label,
      displayPrice: display?.displayPrice ?? null,
      evaluationLimit: plan.evaluationLimit,
      projectsLimit: Number.isFinite(plan.projectsLimit)
        ? plan.projectsLimit
        : -1,
      features: display?.features ?? [],
      priceId: plan.priceId,
    };
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <h1 className="text-2xl font-semibold">Billing</h1>

      {showCheckoutSuccess && <CheckoutSuccessBanner show />}

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
                    nextResetDate: subscription.next_reset_date,
                  }
                : null
            }
          />
          <Separator />
          <UsageMeter
            used={evaluationsUsed}
            limit={evaluationLimit}
            plan={currentPlan}
            nextResetDate={subscription?.next_reset_date}
          />
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

      <PlanTransitionHistory transitions={transitions} />
    </div>
  );
}
