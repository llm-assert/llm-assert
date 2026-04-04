import { resolveAuth, AuthError } from "@/lib/api/auth";
import { success, error, OPTIONS as corsOptions } from "@/lib/api/response";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 30;

export function OPTIONS(): Response {
  return corsOptions();
}

export async function GET(request: Request): Promise<Response> {
  try {
    const auth = await resolveAuth(request);

    if (auth.authMethod === "api_key") {
      if (!auth.projectId) {
        return error("UNAUTHORIZED", "API key is not scoped to a project", 403);
      }
      // API key path: return only the key's project
      const db = supabaseAdmin();
      const { data: projects, error: dbError } = await db
        .from("projects")
        .select("id, name, slug, description, created_at")
        .eq("id", auth.projectId)
        .eq("user_id", auth.userId);

      if (dbError) throw dbError;
      return success(projects ?? [], {
        headers: { "Cache-Control": "public, max-age=60" },
        cors: true,
      });
    }

    // Session path: explicit user_id filter + RLS (defence-in-depth per CLAUDE.md)
    const supabase = await createClient();
    const { data: projects, error: dbError } = await supabase
      .from("projects")
      .select("id, name, slug, description, created_at")
      .eq("user_id", auth.userId)
      .order("created_at", { ascending: false });

    if (dbError) throw dbError;
    return success(projects ?? [], {
      headers: { "Cache-Control": "private, max-age=60" },
    });
  } catch (e) {
    if (e instanceof AuthError) {
      return error(e.code, e.message, e.status);
    }
    console.error("[api/projects] Internal error:", e);
    return error("INTERNAL_ERROR", "Internal server error", 500);
  }
}
