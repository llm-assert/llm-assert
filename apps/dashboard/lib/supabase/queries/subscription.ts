import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type SubscriptionRow = {
  status: string;
  plan: string;
  evaluations_used: number;
  evaluation_limit: number;
  current_period_end: string | null;
};

/**
 * Layer 2: Cross-request cache with 60s revalidation + per-user tag.
 * Stripe webhook handler calls revalidateTag(`subscription-${userId}`)
 * to bust this cache immediately on billing events.
 */
function getCachedSubscription(userId: string) {
  return unstable_cache(
    async (): Promise<SubscriptionRow | null> => {
      try {
        const supabase = await createClient();
        const { data, error } = await supabase
          .from("subscriptions")
          .select(
            "status, plan, evaluations_used, evaluation_limit, current_period_end",
          )
          .eq("user_id", userId)
          .maybeSingle();

        if (error) {
          console.error(
            JSON.stringify({
              source: "getSubscription",
              userId,
              error: error.message,
            }),
          );
          return null;
        }

        return data;
      } catch {
        return null;
      }
    },
    [`subscription-${userId}`],
    { revalidate: 60, tags: [`subscription-${userId}`] },
  )();
}

/**
 * Fetch the authenticated user's subscription row.
 *
 * Layer 1: React.cache() deduplicates within a single render pass
 * (e.g., layout + billing page both calling this = 1 invocation).
 *
 * Layer 2: unstable_cache with per-user tag caches across requests for 60s.
 * Invalidated by revalidateTag(`subscription-${userId}`) from Stripe webhook.
 *
 * Returns null if no subscription row exists or on error.
 */
export const getSubscription = cache(
  async (userId: string): Promise<SubscriptionRow | null> => {
    return getCachedSubscription(userId);
  },
);
