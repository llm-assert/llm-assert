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
  { params }: { params: Promise<{ slug: string; runId: string }> },
): Promise<Response> {
  try {
    const { slug, runId } = await params;
    const auth = await resolveAuth(request);
    const project = await resolveProject(slug, auth);

    const db =
      auth.authMethod === "api_key" ? supabaseAdmin() : await createClient();

    // Explicit user_id filter on both paths (defence-in-depth per CLAUDE.md)
    const query = db
      .from("test_runs")
      .select(
        "id, started_at, finished_at, branch, commit_sha, ci_provider, ci_run_url, total_evaluations, passed, failed, inconclusive",
      )
      .eq("id", runId)
      .eq("project_id", project.id)
      .eq("user_id", auth.userId);

    const { data: run, error: dbError } = await query.single();

    if (dbError || !run) {
      return error("RUN_NOT_FOUND", "Run not found", 404);
    }

    // Get average score for this run
    const avgQuery = db
      .from("evaluations")
      .select("score")
      .eq("test_run_id", runId)
      .not("score", "is", null);

    const { data: scores } = await avgQuery;
    const scoreValues = (scores ?? [])
      .map((r: { score: number | null }) => r.score)
      .filter((s): s is number => s != null);
    const avgScore =
      scoreValues.length > 0
        ? scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length
        : null;

    return success(
      { ...run, avgScore },
      {
        headers: {
          "Cache-Control": `${auth.authMethod === "api_key" ? "public" : "private"}, max-age=60, stale-while-revalidate=120`,
        },
        cors: auth.authMethod === "api_key",
      },
    );
  } catch (e) {
    if (e instanceof AuthError) {
      return error(e.code, e.message, e.status);
    }
    console.error("[api/projects/runs/[runId]] Internal error:", e);
    return error("INTERNAL_ERROR", "Internal server error", 500);
  }
}
