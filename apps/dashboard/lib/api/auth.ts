import "server-only";

import { createHash } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type AuthResult = {
  userId: string;
  projectId: string | null;
  authMethod: "api_key" | "session";
};

class AuthError extends Error {
  constructor(
    public code: string,
    public message: string,
    public status: number,
  ) {
    super(message);
  }
}

export { AuthError };

/**
 * Dual-auth resolution: Bearer-first, fallback to session cookie.
 *
 * - If Authorization: Bearer header is present, authenticate via API key hash lookup.
 *   Invalid Bearer token returns 401 immediately (no fallback to cookie).
 * - If no Bearer header, fall back to session cookie via supabase.auth.getUser().
 */
export async function resolveAuth(request: Request): Promise<AuthResult> {
  const authHeader = request.headers.get("authorization");

  if (authHeader?.startsWith("Bearer ")) {
    return resolveApiKeyAuth(authHeader.slice(7));
  }

  return resolveSessionAuth();
}

async function resolveApiKeyAuth(token: string): Promise<AuthResult> {
  if (!token) {
    throw new AuthError("UNAUTHORIZED", "Missing or invalid API key", 401);
  }

  const keyHash = createHash("sha256").update(token).digest("hex");
  const db = supabaseAdmin();

  const { data: apiKey, error } = await db
    .from("api_keys")
    .select("id, project_id, user_id")
    .eq("key_hash", keyHash)
    .is("revoked_at", null)
    .single();

  if (error || !apiKey) {
    throw new AuthError("UNAUTHORIZED", "Missing or invalid API key", 401);
  }

  return {
    userId: apiKey.user_id,
    projectId: apiKey.project_id,
    authMethod: "api_key",
  };
}

async function resolveSessionAuth(): Promise<AuthResult> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) throw authError;
  if (!user) {
    throw new AuthError("UNAUTHORIZED", "Authentication required", 401);
  }

  return {
    userId: user.id,
    projectId: null,
    authMethod: "session",
  };
}

/**
 * Resolve a project by slug, validating ownership against the auth result.
 * - API key path: verifies apiKey.project_id matches the slug's project
 * - Session path: queries with RLS (user_id filter)
 */
export async function resolveProject(
  slug: string,
  auth: AuthResult,
): Promise<{
  id: string;
  name: string;
  slug: string;
  description: string | null;
}> {
  if (auth.authMethod === "api_key") {
    if (!auth.projectId) {
      throw new AuthError(
        "UNAUTHORIZED",
        "API key is not scoped to a project",
        403,
      );
    }
    const db = supabaseAdmin();
    const { data: project } = await db
      .from("projects")
      .select("id, name, slug, description")
      .eq("id", auth.projectId)
      .eq("user_id", auth.userId)
      .single();

    if (!project || project.slug !== slug) {
      throw new AuthError("PROJECT_NOT_FOUND", "Project not found", 404);
    }
    return project;
  }

  // Session path: explicit user_id filter + RLS (defence-in-depth per CLAUDE.md)
  const supabase = await createClient();
  const { data: project } = await supabase
    .from("projects")
    .select("id, name, slug, description")
    .eq("slug", slug)
    .eq("user_id", auth.userId)
    .single();

  if (!project) {
    throw new AuthError("PROJECT_NOT_FOUND", "Project not found", 404);
  }
  return project;
}
