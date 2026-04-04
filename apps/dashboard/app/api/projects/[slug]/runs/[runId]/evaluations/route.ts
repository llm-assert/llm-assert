import { resolveAuth, resolveProject, AuthError } from "@/lib/api/auth";
import { paginated, error, OPTIONS as corsOptions } from "@/lib/api/response";
import { parsePagination, parseEvaluationFilters } from "@/lib/api/params";
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

    const { searchParams } = new URL(request.url);

    const pagination = parsePagination(searchParams);
    if ("error" in pagination) {
      return error("INVALID_PARAMS", pagination.error, 400);
    }

    const filters = parseEvaluationFilters(searchParams);
    if ("error" in filters) {
      return error("INVALID_PARAMS", filters.error, 400);
    }

    const { page, pageSize } = pagination;
    const offset = (page - 1) * pageSize;

    const db =
      auth.authMethod === "api_key" ? supabaseAdmin() : await createClient();

    // Verify run belongs to project — explicit user_id on both paths
    const runQuery = db
      .from("test_runs")
      .select("id")
      .eq("id", runId)
      .eq("project_id", project.id)
      .eq("user_id", auth.userId);

    const { data: run } = await runQuery.single();
    if (!run) {
      return error("RUN_NOT_FOUND", "Run not found", 404);
    }

    // Build evaluations query — explicit user_id filter for defence-in-depth
    let query = db
      .from("evaluations")
      .select(
        "id, assertion_type, result, score, reasoning, input, expected, actual, created_at",
        { count: "exact" },
      )
      .eq("test_run_id", runId)
      .eq("user_id", auth.userId)
      .order("created_at", { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (filters.type) {
      query = query.eq("assertion_type", filters.type);
    }
    if (filters.result) {
      query = query.eq("result", filters.result);
    }

    const { data: evaluations, count, error: dbError } = await query;

    if (dbError) throw dbError;

    const total = count ?? 0;
    return paginated(
      evaluations ?? [],
      {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
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
    console.error("[api/projects/evaluations] Internal error:", e);
    return error("INTERNAL_ERROR", "Internal server error", 500);
  }
}
