import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { PlanName, PlanDisplay } from "@/lib/plans.client";
import { BillingActions } from "./billing-actions";

type BillingPlanCard = PlanDisplay & { priceId: string | null };

export function PlanCards({
  plans,
  currentPlan,
  subscriptionStatus,
}: {
  plans: BillingPlanCard[];
  currentPlan: PlanName;
  subscriptionStatus: "active" | "past_due" | "canceled" | null;
}) {
  // Only show paid plans
  const paidPlans = plans.filter((p) => p.priceId !== null);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {paidPlans.map((plan) => {
        const isCurrent = plan.name === currentPlan;
        const currentPlanId = `current-plan-${plan.name}`;

        return (
          <Card
            key={plan.name}
            className={cn("flex flex-col", isCurrent && "ring-2 ring-primary")}
            aria-describedby={isCurrent ? currentPlanId : undefined}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {plan.label}
                {isCurrent && (
                  <Badge id={currentPlanId} variant="outline">
                    Current plan
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                {plan.evaluationLimit.toLocaleString()} evaluations / month
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  {plan.projectsLimit < 0 ? "Unlimited" : plan.projectsLimit}{" "}
                  {plan.projectsLimit === 1 ? "project" : "projects"}
                </li>
              </ul>
            </CardContent>
            <CardFooter>
              {isCurrent &&
              subscriptionStatus === "active" &&
              currentPlan !== "free" ? (
                <BillingActions action="portal" />
              ) : !isCurrent &&
                subscriptionStatus === "active" &&
                currentPlan !== "free" ? (
                <span className="text-xs text-muted-foreground">
                  Manage your plan to switch tiers
                </span>
              ) : plan.priceId ? (
                <BillingActions action="checkout" priceId={plan.priceId} />
              ) : null}
            </CardFooter>
          </Card>
        );
      })}
    </div>
  );
}
