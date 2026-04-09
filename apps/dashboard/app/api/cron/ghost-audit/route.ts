import { supabaseAdmin } from "@/lib/supabase/admin";
import { verifyCronSecret, logCron } from "@/lib/cron/utils";
import { createLogger } from "@/lib/logger";

const log = createLogger("cron/ghost-audit");

export const maxDuration = 30;

interface GhostAuditResult {
  ghost_count: number;
  definite_count: number;
  possible_noop_count: number;
  event_types: string[];
  oldest_ghost_at: string | null;
  newest_ghost_at: string | null;
  sample_event_ids: string[];
}

export async function GET(request: Request): Promise<Response> {
  const start = performance.now();
  const source = "cron-ghost-audit";

  if (!verifyCronSecret(request)) {
    logCron(source, "auth_failure");
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = supabaseAdmin();
  const { data, error } = await db.rpc("ghost_event_audit");

  if (error) {
    const durationMs = Math.round(performance.now() - start);
    logCron(source, "error", { error: error.message, duration_ms: durationMs });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }

  const result = data as GhostAuditResult;
  const durationMs = Math.round(performance.now() - start);

  if (result.definite_count > 0) {
    log.error(
      {
        event: "ghost_events_detected",
        ghostCount: result.ghost_count,
        definiteCount: result.definite_count,
        possibleNoopCount: result.possible_noop_count,
        eventTypes: result.event_types,
        oldestGhostAt: result.oldest_ghost_at,
        newestGhostAt: result.newest_ghost_at,
        sampleEventIds: result.sample_event_ids,
        durationMs,
      },
      "ghost events detected",
    );
  } else {
    logCron(source, "ghost_audit_clean", {
      ghost_count: result.ghost_count,
      possible_noop_count: result.possible_noop_count,
      duration_ms: durationMs,
    });
  }

  return Response.json({
    ok: true,
    data: result,
    duration_ms: durationMs,
  });
}
