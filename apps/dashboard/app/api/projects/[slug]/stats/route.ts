import { resolveAuth, resolveProject, AuthError } from "@/lib/api/auth";
import { success, error, OPTIONS as corsOptions } from "@/lib/api/response";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

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

    let stats;

    if (auth.authMethod === "session") {
      // Session path: RPC uses auth.uid() for ownership check
      const supabase = await createClient();
      const { data, error: rpcError } = await supabase.rpc(
        "get_project_stats",
        { p_project_id: project.id },
      );
      if (rpcError) throw rpcError;
      stats = data;
    } else {
      // API key path: aggregate from test_runs (has denormalized counts) + evaluations for avg_score.
      // Cannot use RPC because auth.uid() returns NULL for admin client.
      const db = supabaseAdmin();

      // Aggregate from denormalized test_runs columns
      const { data: runs, error: runsError } = await db
        .from("test_runs")
        .select("id, total_evaluations, passed, failed, inconclusive")
        .eq("project_id", project.id)
        .eq("user_id", auth.userId);

      if (runsError) throw runsError;

      const runRows = runs ?? [];
      const total = runRows.reduce((sum, r) => sum + r.total_evaluations, 0);
      const passed = runRows.reduce((sum, r) => sum + r.passed, 0);
      const failed = runRows.reduce((sum, r) => sum + r.failed, 0);
      const inconclusive = runRows.reduce((sum, r) => sum + r.inconclusive, 0);

      // Get avg score from evaluations (need to join through test_run_id)
      let avgScore: number | null = null;
      if (runRows.length > 0) {
        const runIds = runRows.map((r) => r.id);
        const { data: evalRows } = await db
          .from("evaluations")
          .select("score")
          .in("test_run_id", runIds)
          .not("score", "is", null);

        const scores = (evalRows ?? [])
          .map((r: { score: number | null }) => r.score)
          .filter((s): s is number => s != null);
        avgScore =
          scores.length > 0
            ? scores.reduce((a, b) => a + b, 0) / scores.length
            : null;
      }

      stats = {
        total_evaluations: total,
        passed,
        failed,
        inconclusive,
        pass_rate: total > 0 ? (passed / total) * 100 : 0,
        fail_rate: total > 0 ? (failed / total) * 100 : 0,
        avg_score: avgScore,
      };
    }

    // Normalize to camelCase for the API response
    const row = Array.isArray(stats) ? stats[0] : stats;
    return success(
      {
        totalEvaluations: row?.total_evaluations ?? 0,
        passed: row?.passed ?? 0,
        failed: row?.failed ?? 0,
        inconclusive: row?.inconclusive ?? 0,
        passRate: row?.pass_rate ?? 0,
        failRate: row?.fail_rate ?? 0,
        avgScore: row?.avg_score ?? null,
      },
      {
        headers: {
          "Cache-Control": `${auth.authMethod === "api_key" ? "public" : "private"}, max-age=300, stale-while-revalidate=600`,
        },
        cors: auth.authMethod === "api_key",
      },
    );
  } catch (e) {
    if (e instanceof AuthError) {
      return error(e.code, e.message, e.status);
    }
    console.error("[api/projects/stats] Internal error:", e);
    return error("INTERNAL_ERROR", "Internal server error", 500);
  }
}
