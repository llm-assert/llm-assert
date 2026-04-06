import { timingSafeEqual } from "node:crypto";
import { serverEnv } from "@/lib/env.server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const maxDuration = 60;

export async function GET(request: Request): Promise<Response> {
  const start = performance.now();

  // Guard: CRON_SECRET must be configured
  const cronSecret = serverEnv.CRON_SECRET;
  if (!cronSecret) {
    logCron("auth_failure", { error: "CRON_SECRET not configured" });
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Guard: Authorization header must match Bearer ${CRON_SECRET}
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !isValidCronSecret(authHeader, cronSecret)) {
    logCron("auth_failure");
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Execute the reset function via service_role admin client
  const db = supabaseAdmin();
  const { data, error } = await db.rpc("reset_evaluations_for_period");

  if (error) {
    const durationMs = Math.round(performance.now() - start);
    logCron("error", { error: error.message, duration_ms: durationMs });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }

  const result = Array.isArray(data) ? data[0] : data;
  const paidResetCount: number = result?.paid_reset_count ?? 0;
  const freeResetCount: number = result?.free_reset_count ?? 0;
  const durationMs = Math.round(performance.now() - start);

  logCron("success", {
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Timing-safe comparison of the Authorization header against the expected
 * Bearer token. Returns false (rather than throwing) on length mismatch.
 */
function isValidCronSecret(authHeader: string, secret: string): boolean {
  const expected = `Bearer ${secret}`;
  if (authHeader.length !== expected.length) {
    return false;
  }
  try {
    return timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected));
  } catch {
    return false;
  }
}

function logCron(
  event: string,
  details?: Record<string, string | number>,
): void {
  const entry = {
    source: "cron-reset",
    event,
    ...details,
  };
  if (event === "error" || event === "auth_failure") {
    console.error(JSON.stringify(entry));
  } else {
    console.log(JSON.stringify(entry));
  }
}
