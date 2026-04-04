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

    let formatted;

    if (auth.authMethod === "session") {
      const supabase = await createClient();
      const { data, error: rpcError } = await supabase.rpc(
        "get_assertion_type_breakdown",
        { p_project_id: project.id, p_days: days },
      );
      if (rpcError) throw rpcError;

      formatted = (data ?? []).map(
        (row: {
          assertion_type: string;
          total: number;
          passed: number;
          failed: number;
          inconclusive: number;
        }) => ({
          assertionType: row.assertion_type,
          total: row.total,
          passed: row.passed,
          failed: row.failed,
          inconclusive: row.inconclusive,
        }),
      );
    } else {
      // API key path: cannot use RPC (auth.uid() returns NULL for admin client).
      // Query evaluations through test_runs and group by assertion_type in JS.
      const db = supabaseAdmin();
      const startDate = new Date();
      startDate.setUTCDate(startDate.getUTCDate() - days);
      startDate.setUTCHours(0, 0, 0, 0);

      const { data: runs, error: runsError } = await db
        .from("test_runs")
        .select("id")
        .eq("project_id", project.id)
        .eq("user_id", auth.userId)
        .gte("started_at", startDate.toISOString());

      if (runsError) throw runsError;

      if (!runs || runs.length === 0) {
        formatted = [];
      } else {
        const runIds = runs.map((r) => r.id);
        const { data: evals, error: evalsError } = await db
          .from("evaluations")
          .select("assertion_type, result")
          .in("test_run_id", runIds);

        if (evalsError) throw evalsError;

        // Group by assertion_type
        const groups = new Map<
          string,
          {
            total: number;
            passed: number;
            failed: number;
            inconclusive: number;
          }
        >();

        for (const ev of evals ?? []) {
          const group = groups.get(ev.assertion_type) ?? {
            total: 0,
            passed: 0,
            failed: 0,
            inconclusive: 0,
          };
          group.total++;
          if (ev.result === "pass") group.passed++;
          else if (ev.result === "fail") group.failed++;
          else group.inconclusive++;
          groups.set(ev.assertion_type, group);
        }

        formatted = Array.from(groups.entries())
          .map(([assertionType, counts]) => ({
            assertionType,
            ...counts,
          }))
          .sort((a, b) => b.total - a.total);
      }
    }

    return success(formatted, {
      headers: {
        "Cache-Control": `${auth.authMethod === "api_key" ? "public" : "private"}, max-age=300, stale-while-revalidate=600`,
      },
      cors: auth.authMethod === "api_key",
    });
  } catch (e) {
    if (e instanceof AuthError) {
      return error(e.code, e.message, e.status);
    }
    console.error("[api/projects/breakdown] Internal error:", e);
    return error("INTERNAL_ERROR", "Internal server error", 500);
  }
}
