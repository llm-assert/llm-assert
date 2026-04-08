import { Badge } from "@/components/ui/badge";
import type { PlanName } from "@/lib/plans.client";
import { getPlanDisplay } from "@/lib/plans.client";

type SubscriptionState = {
  plan: PlanName;
  status: "active" | "past_due" | "canceled";
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  nextResetDate: string | null;
};

export function getSubscriptionDisplayState(
  status: string,
  cancelAtPeriodEnd: boolean,
): {
  label: string;
  badgeVariant: "default" | "warning" | "destructive" | "secondary";
  datePrefix: string;
} {
  if (status === "active" && cancelAtPeriodEnd) {
    return {
      label: "Canceling",
      badgeVariant: "warning",
      datePrefix: "Cancels",
    };
  }
  if (status === "active") {
    return { label: "Active", badgeVariant: "default", datePrefix: "Renews" };
  }
  if (status === "past_due") {
    return {
      label: "Past due",
      badgeVariant: "destructive",
      datePrefix: "Ended",
    };
  }
  return { label: "Canceled", badgeVariant: "secondary", datePrefix: "Ended" };
}

export function SubscriptionStatus({
  subscription,
}: {
  subscription: SubscriptionState | null;
}) {
  const currentPlan = subscription?.plan ?? "free";
  const planDisplay = getPlanDisplay(currentPlan);
  const isFree = currentPlan === "free";
  const status = subscription?.status ?? null;

  const displayState =
    status && !isFree
      ? getSubscriptionDisplayState(
          status,
          subscription?.cancelAtPeriodEnd ?? false,
        )
      : null;

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <h2 className="text-xl font-semibold">{planDisplay.label}</h2>
        {displayState && (
          <Badge
            variant={displayState.badgeVariant}
            data-testid="subscription-status-badge"
          >
            {displayState.label}
          </Badge>
        )}
        {isFree && <Badge variant="secondary">Free</Badge>}
      </div>
      {displayState && subscription?.currentPeriodEnd && (
        <p
          className="text-sm text-muted-foreground"
          data-testid="subscription-status-period-label"
        >
          {displayState.datePrefix}{" "}
          <time dateTime={subscription.currentPeriodEnd}>
            {new Date(subscription.currentPeriodEnd).toLocaleDateString(
              undefined,
              { month: "long", day: "numeric", year: "numeric" },
            )}
          </time>
        </p>
      )}
      {isFree && (
        <p className="text-sm text-muted-foreground">
          {subscription?.nextResetDate ? (
            <>
              Evaluations reset{" "}
              <time dateTime={subscription.nextResetDate}>
                {new Date(subscription.nextResetDate).toLocaleDateString(
                  undefined,
                  { month: "long", day: "numeric" },
                )}
              </time>{" "}
              (monthly on the 1st, UTC).
            </>
          ) : (
            <>Upgrade to unlock more evaluations and projects.</>
          )}
        </p>
      )}
      {subscription?.status === "canceled" && !isFree && (
        <p className="text-sm text-muted-foreground">
          Your subscription has been canceled. Subscribe again to continue using
          paid features.
        </p>
      )}
    </div>
  );
}
