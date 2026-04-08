import { supabaseAdmin } from "@/lib/supabase/admin";
import { verifyCronSecret, logCron } from "@/lib/cron/utils";

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
    console.error(
      JSON.stringify({
        source,
        event: "ghost_events_detected",
        ghost_count: result.ghost_count,
        definite_count: result.definite_count,
        possible_noop_count: result.possible_noop_count,
        event_types: result.event_types,
        oldest_ghost_at: result.oldest_ghost_at,
        newest_ghost_at: result.newest_ghost_at,
        sample_event_ids: result.sample_event_ids,
        duration_ms: durationMs,
      }),
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
