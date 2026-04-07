import { revalidateTag } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { verifyCronSecret, logCron } from "@/lib/cron/utils";

export const maxDuration = 60;

export async function GET(request: Request): Promise<Response> {
  const startWallClock = new Date().toISOString();
  const start = performance.now();

  // Guard: Authorization header must match Bearer ${CRON_SECRET}
  if (!verifyCronSecret(request)) {
    logCron("cron-reset", "auth_failure");
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Execute the reset function via service_role admin client
  const db = supabaseAdmin();
  const { data, error } = await db.rpc("reset_evaluations_for_period");

  if (error) {
    const durationMs = Math.round(performance.now() - start);
    logCron("cron-reset", "error", {
      error: error.message,
      duration_ms: durationMs,
    });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }

  const result = Array.isArray(data) ? data[0] : data;
  const paidResetCount: number = result?.paid_reset_count ?? 0;
  const freeResetCount: number = result?.free_reset_count ?? 0;
  const durationMs = Math.round(performance.now() - start);

  // Invalidate subscription cache for users whose quota was just reset
  const totalResets = paidResetCount + freeResetCount;
  if (totalResets > 0) {
    try {
      const { data: resetUsers } = await db
        .from("subscriptions")
        .select("user_id")
        .eq("status", "active")
        .gt("last_evaluations_reset_at", startWallClock);

      if (resetUsers) {
        for (const row of resetUsers) {
          try {
            revalidateTag(`subscription-${row.user_id}`, "max");
          } catch (tagError) {
            logCron("cron-reset", "cache_invalidation_error", {
              user_id: row.user_id,
              error:
                tagError instanceof Error ? tagError.message : "Unknown error",
            });
          }
        }
      }
    } catch (queryError) {
      logCron("cron-reset", "cache_invalidation_error", {
        error:
          queryError instanceof Error ? queryError.message : "Unknown error",
      });
    }
  }

  logCron("cron-reset", "success", {
    paid_reset_count: paidResetCount,
    free_reset_count: freeResetCount,
    duration_ms: durationMs,
  });

  return Response.json({
    success: true,
    paid_reset_count: paidResetCount,
    free_reset_count: freeResetCount,
  });
}
