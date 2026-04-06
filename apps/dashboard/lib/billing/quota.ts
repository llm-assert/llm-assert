import type { PlanName } from "@/lib/plans.client";
import type { SubscriptionRow } from "@/lib/supabase/queries/subscription";

/**
 * Per-plan thresholds for the global dashboard banner.
 * These are intentionally higher than the UsageMeter's 80% threshold
 * to avoid duplicate signals and banner fatigue on low-limit plans.
 */
export const GLOBAL_BANNER_THRESHOLDS: Record<PlanName, number> = {
  free: 0.95,
  starter: 0.95,
  pro: 0.9,
  team: 0.9,
};

export type BillingAlertState =
  | { state: "past_due" }
  | { state: "quota_exceeded"; used: number; limit: number }
  | {
      state: "quota_warning";
      used: number;
      limit: number;
      remaining: number;
    }
  | { state: "none" };

/**
 * Pure function: derives the highest-priority billing alert state.
 * Priority: past_due > quota_exceeded > quota_warning > none.
 */
export function getBillingAlertState(
  subscription: SubscriptionRow | null,
): BillingAlertState {
  if (!subscription) return { state: "none" };

  if (subscription.status === "past_due") {
    return { state: "past_due" };
  }

  const used = subscription.evaluations_used;
  const limit = subscription.evaluation_limit;

  if (limit <= 0) return { state: "none" };

  if (used >= limit) {
    return { state: "quota_exceeded", used, limit };
  }

  const plan = subscription.plan as PlanName;
  const threshold =
    GLOBAL_BANNER_THRESHOLDS[plan] ?? GLOBAL_BANNER_THRESHOLDS.free;
  const ratio = used / limit;

  if (ratio >= threshold) {
    return {
      state: "quota_warning",
      used,
      limit,
      remaining: limit - used,
    };
  }

  return { state: "none" };
}
