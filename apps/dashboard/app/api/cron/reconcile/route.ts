import { supabaseAdmin } from "@/lib/supabase/admin";
import { verifyCronSecret, logCron } from "@/lib/cron/utils";
import {
  ABNORMAL_RUN_DRIFT_THRESHOLD,
  ABNORMAL_QUOTA_DRIFT_THRESHOLD,
} from "@/lib/cron/reconcile-config";
import { createLogger } from "@/lib/logger";

const log = createLogger("cron/reconcile");

export const maxDuration = 60;

interface DriftRow {
  kind: "run_counter" | "quota";
  entity_id: string;
  stored_value: number;
  actual_value: number;
  delta: number;
}

export async function GET(request: Request): Promise<Response> {
  const start = performance.now();
  const source = "cron-reconcile";

  // Guard: Authorization header must match Bearer ${CRON_SECRET}
  if (!verifyCronSecret(request)) {
    logCron(source, "auth_failure");
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Execute the reconciliation RPC via service_role admin client
  const db = supabaseAdmin();
  const { data, error } = await db.rpc("reconcile_counters");

  if (error) {
    const durationMs = Math.round(performance.now() - start);
    logCron(source, "error", { error: error.message, duration_ms: durationMs });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }

  const rows: DriftRow[] = (data as DriftRow[]) ?? [];
  const durationMs = Math.round(performance.now() - start);

  // Classify and log each drift row
  const runDriftRows = rows.filter((r) => r.kind === "run_counter");
  const quotaDriftRows = rows.filter((r) => r.kind === "quota");

  for (const row of rows) {
    const threshold =
      row.kind === "run_counter"
        ? ABNORMAL_RUN_DRIFT_THRESHOLD
        : ABNORMAL_QUOTA_DRIFT_THRESHOLD;
    const severity = Math.abs(row.delta) > threshold ? "abnormal" : "normal";

    const driftEntry = {
      event: "drift_detected",
      driftType: row.kind,
      entityId: row.entity_id,
      storedValue: row.stored_value,
      actualValue: row.actual_value,
      delta: row.delta,
      severity,
    };

    // Abnormal drift goes to error level for alerting; normal drift to info
    if (severity === "abnormal") {
      log.error(driftEntry, "abnormal drift detected");
    } else {
      log.info(driftEntry, "drift detected");
    }
  }

  // Compute aggregates for response
  const maxDrift =
    rows.length > 0 ? Math.max(...rows.map((r) => Math.abs(r.delta))) : 0;

  // Terminal summary event
  if (rows.length === 0) {
    logCron(source, "no_drift", { duration_ms: durationMs });
  } else {
    logCron(source, "success", {
      drifted_runs: runDriftRows.length,
      drifted_users: quotaDriftRows.length,
      max_drift: maxDrift,
      duration_ms: durationMs,
    });
  }

  return Response.json({
    success: true,
    drifted_runs: runDriftRows.length,
    drifted_users: quotaDriftRows.length,
    max_drift: maxDrift,
    duration_ms: durationMs,
  });
}
