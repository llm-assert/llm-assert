import { getAuthUser } from "@/lib/queries/get-auth-user";
import { getSubscription } from "@/lib/supabase/queries/subscription";
import { getBillingAlertState } from "@/lib/billing/quota";
import { PastDueBanner } from "./past-due-banner";
import {
  QuotaWarningBanner,
  QuotaExceededBanner,
} from "./quota-warning-banner";

export async function BillingAlertBanner() {
  try {
    const user = await getAuthUser();

    if (!user) return null;

    const subscription = await getSubscription(user.id);
    const alertState = getBillingAlertState(subscription);

    switch (alertState.state) {
      case "past_due":
        return <PastDueBanner />;
      case "quota_exceeded":
        return (
          <QuotaExceededBanner
            used={alertState.used}
            limit={alertState.limit}
            plan={alertState.plan}
            nextResetDate={alertState.nextResetDate}
          />
        );
      case "quota_warning":
        return (
          <QuotaWarningBanner
            used={alertState.used}
            limit={alertState.limit}
            remaining={alertState.remaining}
            plan={alertState.plan}
            nextResetDate={alertState.nextResetDate}
          />
        );
      default:
        return null;
    }
  } catch (error) {
    console.error(
      JSON.stringify({
        source: "BillingAlertBanner",
        error: error instanceof Error ? error.message : "Unknown error",
      }),
    );
    return null;
  }
}
