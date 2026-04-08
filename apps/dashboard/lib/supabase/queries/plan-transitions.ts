import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type PlanTransitionRow = {
  id: string;
  old_plan: string | null;
  new_plan: string;
  old_status: string | null;
  new_status: string;
  reason: string;
  created_at: string;
};

/**
 * Layer 2: Cross-request cache with 60s revalidation + per-user tag.
 * Stripe webhook handler calls revalidateTag(`subscription-${userId}`)
 * to bust this cache immediately on billing events.
 */
function getCachedPlanTransitions(userId: string) {
  return unstable_cache(
    async (): Promise<PlanTransitionRow[]> => {
      try {
        const supabase = await createClient();
        const { data, error } = await supabase
          .from("plan_transitions")
          .select(
            "id, old_plan, new_plan, old_status, new_status, reason, created_at",
          )
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(20);

        if (error) {
          console.error(
            JSON.stringify({
              source: "getPlanTransitions",
              userId,
              error: error.message,
            }),
          );
          return [];
        }

        return data ?? [];
      } catch {
        return [];
      }
    },
    [`plan-transitions-${userId}`],
    { revalidate: 60, tags: [`subscription-${userId}`] },
  )();
}

/**
 * Fetch the authenticated user's plan transition history.
 *
 * Layer 1: React.cache() deduplicates within a single render pass.
 * Layer 2: unstable_cache with per-user tag caches across requests for 60s.
 * Invalidated by revalidateTag(`subscription-${userId}`) from Stripe webhook.
 */
export const getPlanTransitions = cache(
  async (userId: string): Promise<PlanTransitionRow[]> => {
    return getCachedPlanTransitions(userId);
  },
);
