import { Badge } from "@/components/ui/badge";
import type { PlanName } from "@/lib/plans.client";
import { getPlanDisplay } from "@/lib/plans.client";

type SubscriptionState = {
  plan: PlanName;
  status: "active" | "past_due" | "canceled";
  currentPeriodEnd: string | null;
};

const statusConfig = {
  active: { label: "Active", variant: "default" as const },
  past_due: { label: "Past due", variant: "destructive" as const },
  canceled: { label: "Canceled", variant: "secondary" as const },
} as const;

export function SubscriptionStatus({
  subscription,
}: {
  subscription: SubscriptionState | null;
}) {
  const planDisplay = getPlanDisplay(subscription?.plan ?? "free");
  const status = subscription?.status ?? null;
  const config = status ? statusConfig[status] : null;

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <h2 className="text-xl font-semibold">{planDisplay.label}</h2>
        {config && <Badge variant={config.variant}>{config.label}</Badge>}
        {!subscription && <Badge variant="secondary">Free</Badge>}
      </div>
      {subscription?.status === "active" && subscription.currentPeriodEnd && (
        <p className="text-sm text-muted-foreground">
          Renews{" "}
          {new Date(subscription.currentPeriodEnd).toLocaleDateString(
            undefined,
            { month: "long", day: "numeric", year: "numeric" },
          )}
        </p>
      )}
      {!subscription && (
        <p className="text-sm text-muted-foreground">
          Upgrade to unlock more evaluations and projects.
        </p>
      )}
      {subscription?.status === "canceled" && (
        <p className="text-sm text-muted-foreground">
          Your subscription has been canceled. Subscribe again to continue using
          paid features.
        </p>
      )}
    </div>
  );
}
