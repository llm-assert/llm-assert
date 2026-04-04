import { resolveAuth, resolveProject, AuthError } from "@/lib/api/auth";
import { success, error, OPTIONS as corsOptions } from "@/lib/api/response";
import { parseDays } from "@/lib/api/params";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const maxDuration = 30;

export function OPTIONS(): Response {
  return corsOptions();
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  try {
    const { slug } = await params;
    const auth = await resolveAuth(request);
    const project = await resolveProject(slug, auth);

    const { searchParams } = new URL(request.url);
    const days = parseDays(searchParams);
    if (typeof days === "object" && "error" in days) {
      return error("INVALID_PARAMS", days.error, 400);
    }

    let trends;

    if (auth.authMethod === "session") {
      const supabase = await createClient();
      const { data, error: rpcError } = await supabase.rpc(
        "get_project_trends",
        { p_project_id: project.id, p_bucket: "day", p_days: days },
      );
      if (rpcError) throw rpcError;
      // Normalize RPC output: bucket (timestamptz) → date (YYYY-MM-DD), avg_score → avgScore
      trends = (data ?? []).map(
        (row: {
          bucket: string;
          total: number;
          passed: number;
          failed: number;
          inconclusive: number;
          avg_score: number | null;
        }) => ({
          date: row.bucket.slice(0, 10),
          total: row.total,
          passed: row.passed,
          failed: row.failed,
          inconclusive: row.inconclusive,
          avgScore: row.avg_score,
        }),
      );
    } else {
      // API key path: cannot use RPC (auth.uid() returns NULL for admin client).
      // Query test_runs + evaluations directly and bucket by day in JS.
      const db = supabaseAdmin();
      const startDate = new Date();
      startDate.setUTCDate(startDate.getUTCDate() - days);
      startDate.setUTCHours(0, 0, 0, 0);

      const { data: runs, error: runsError } = await db
        .from("test_runs")
        .select("id, started_at")
        .eq("project_id", project.id)
        .eq("user_id", auth.userId)
        .gte("started_at", startDate.toISOString());

      if (runsError) throw runsError;

      if (!runs || runs.length === 0) {
        trends = [];
      } else {
        const runIds = runs.map((r) => r.id);
        const { data: evals, error: evalsError } = await db
          .from("evaluations")
          .select("test_run_id, result, score")
          .in("test_run_id", runIds);

        if (evalsError) throw evalsError;

        // Build a map of run_id → started_at for date bucketing
        const runDateMap = new Map(runs.map((r) => [r.id, r.started_at]));

        // Bucket evaluations by day
        const buckets = new Map<
          string,
          {
            total: number;
            passed: number;
            failed: number;
            inconclusive: number;
            scores: number[];
          }
        >();

        for (const ev of evals ?? []) {
          const startedAt = runDateMap.get(ev.test_run_id);
          if (!startedAt) continue;
          const day = startedAt.slice(0, 10); // YYYY-MM-DD
          const bucket = buckets.get(day) ?? {
            total: 0,
            passed: 0,
            failed: 0,
            inconclusive: 0,
            scores: [],
          };
          bucket.total++;
          if (ev.result === "pass") bucket.passed++;
          else if (ev.result === "fail") bucket.failed++;
          else bucket.inconclusive++;
          if (ev.score != null) bucket.scores.push(ev.score);
          buckets.set(day, bucket);
        }

        // Zero-fill missing dates
        trends = [];
        const cursor = new Date(startDate);
        cursor.setUTCHours(0, 0, 0, 0);
        const now = new Date();
        now.setUTCHours(0, 0, 0, 0);

        while (cursor <= now) {
          const day = cursor.toISOString().slice(0, 10);
          const bucket = buckets.get(day);
          trends.push({
            date: day,
            total: bucket?.total ?? 0,
            passed: bucket?.passed ?? 0,
            failed: bucket?.failed ?? 0,
            inconclusive: bucket?.inconclusive ?? 0,
            avgScore: bucket?.scores.length
              ? bucket.scores.reduce((a, b) => a + b, 0) / bucket.scores.length
              : null,
          });
          cursor.setUTCDate(cursor.getUTCDate() + 1);
        }
      }
    }

    return success(trends ?? [], {
      headers: {
        "Cache-Control": `${auth.authMethod === "api_key" ? "public" : "private"}, max-age=300, stale-while-revalidate=600`,
      },
      cors: auth.authMethod === "api_key",
    });
  } catch (e) {
    if (e instanceof AuthError) {
      return error(e.code, e.message, e.status);
    }
    console.error("[api/projects/trends] Internal error:", e);
    return error("INTERNAL_ERROR", "Internal server error", 500);
  }
}
