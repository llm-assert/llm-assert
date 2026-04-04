import { resolveAuth, resolveProject, AuthError } from "@/lib/api/auth";
import { paginated, error, OPTIONS as corsOptions } from "@/lib/api/response";
import { parsePagination } from "@/lib/api/params";
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

    const { searchParams } = new URL(request.url);
    const pagination = parsePagination(searchParams);
    if ("error" in pagination) {
      return error("INVALID_PARAMS", pagination.error, 400);
    }

    const { page, pageSize } = pagination;
    const offset = (page - 1) * pageSize;

    const db =
      auth.authMethod === "api_key" ? supabaseAdmin() : await createClient();

    // Explicit user_id filter on both paths (defence-in-depth per CLAUDE.md)
    const query = db
      .from("test_runs")
      .select(
        "id, started_at, finished_at, branch, commit_sha, ci_provider, ci_run_url, total_evaluations, passed, failed, inconclusive",
        { count: "exact" },
      )
      .eq("project_id", project.id)
      .eq("user_id", auth.userId)
      .order("started_at", { ascending: false })
      .range(offset, offset + pageSize - 1);

    const { data: runs, count, error: dbError } = await query;

    if (dbError) throw dbError;

    const total = count ?? 0;
    return paginated(
      runs ?? [],
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
    console.error("[api/projects/runs] Internal error:", e);
    return error("INTERNAL_ERROR", "Internal server error", 500);
  }
}
