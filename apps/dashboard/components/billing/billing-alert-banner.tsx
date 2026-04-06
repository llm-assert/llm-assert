import { createClient } from "@/lib/supabase/server";
import { getSubscription } from "@/lib/supabase/queries/subscription";
import { getBillingAlertState } from "@/lib/billing/quota";
import { PastDueBanner } from "./past-due-banner";
import {
  QuotaWarningBanner,
  QuotaExceededBanner,
} from "./quota-warning-banner";

export async function BillingAlertBanner() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

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
          />
        );
      case "quota_warning":
        return (
          <QuotaWarningBanner
            used={alertState.used}
            limit={alertState.limit}
            remaining={alertState.remaining}
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
