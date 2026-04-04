import { resolveAuth, resolveProject, AuthError } from "@/lib/api/auth";
import { success, error, OPTIONS as corsOptions } from "@/lib/api/response";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 30;

const ASSERTION_TYPES = ["groundedness", "pii", "sentiment", "schema", "fuzzy"];

const DEFAULT_THRESHOLD = 0.7;

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

    const db =
      auth.authMethod === "api_key" ? supabaseAdmin() : await createClient();

    const { data: rows, error: dbError } = await db
      .from("thresholds")
      .select("assertion_type, pass_threshold")
      .eq("project_id", project.id);

    if (dbError) throw dbError;

    // Build flat object with defaults for missing assertion types
    const thresholds: Record<string, number> = {};
    for (const type of ASSERTION_TYPES) {
      const row = rows?.find((r) => r.assertion_type === type);
      thresholds[type] = row ? Number(row.pass_threshold) : DEFAULT_THRESHOLD;
    }

    return success(thresholds, {
      headers: {
        "Cache-Control":
          auth.authMethod === "api_key"
            ? "public, max-age=300, stale-while-revalidate=600"
            : "private, max-age=60",
      },
      cors: auth.authMethod === "api_key",
    });
  } catch (e) {
    if (e instanceof AuthError) {
      return error(e.code, e.message, e.status);
    }
    console.error("[api/projects/thresholds] Internal error:", e);
    return error("INTERNAL_ERROR", "Internal server error", 500);
  }
}
