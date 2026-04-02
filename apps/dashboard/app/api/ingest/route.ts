import { createHash } from "node:crypto";
import { after } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { IngestPayloadSchema } from "./schema";

export const maxDuration = 30;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
} as const;

function jsonResponse(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

function errorResponse(
  code: string,
  message: string,
  status: number,
  details?: Record<string, unknown>,
): Response {
  return jsonResponse(
    { error: { code, message, ...(details && { details }) } },
    status,
  );
}

export function OPTIONS(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request: Request): Promise<Response> {
  try {
    // 1. Extract Bearer token
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return errorResponse("UNAUTHORIZED", "Missing or invalid API key", 401);
    }
    const token = authHeader.slice(7);
    if (!token) {
      return errorResponse("UNAUTHORIZED", "Missing or invalid API key", 401);
    }

    // 2. SHA-256 hash and lookup
    const keyHash = createHash("sha256").update(token).digest("hex");
    const db = supabaseAdmin();

    const { data: apiKey, error: keyError } = await db
      .from("api_keys")
      .select("id, project_id, user_id")
      .eq("key_hash", keyHash)
      .is("revoked_at", null)
      .single();

    if (keyError || !apiKey) {
      return errorResponse("UNAUTHORIZED", "Missing or invalid API key", 401);
    }

    // 3. Parse and validate payload
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return errorResponse("INVALID_PAYLOAD", "Invalid JSON", 400);
    }

    const parsed = IngestPayloadSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(
        "INVALID_PAYLOAD",
        "Payload validation failed",
        400,
        { issues: parsed.error.issues },
      );
    }
    const payload = parsed.data;

    // 4. Verify project slug matches API key's project
    const { data: project } = await db
      .from("projects")
      .select("slug")
      .eq("id", apiKey.project_id)
      .single();

    if (!project || project.slug !== payload.project_slug) {
      return errorResponse("PROJECT_NOT_FOUND", "Project not found", 404);
    }

    // 5. Atomic ingest: quota check + test_run upsert + evaluations insert
    const { data: result, error: rpcError } = await db.rpc("ingest_test_run", {
      p_user_id: apiKey.user_id,
      p_project_id: apiKey.project_id,
      p_run_id: payload.run_id,
      p_started_at: payload.run.started_at,
      p_finished_at: payload.run.finished_at ?? null,
      p_ci_provider: payload.run.ci_provider ?? null,
      p_ci_run_url: payload.run.ci_run_url ?? null,
      p_branch: payload.run.branch ?? null,
      p_commit_sha: payload.run.commit_sha ?? null,
      p_metadata: payload.run.metadata ?? {},
      p_evaluations: payload.evaluations,
    });

    // Handle RPC errors (e.g., no active subscription — P0002)
    if (rpcError) {
      if (rpcError.message?.includes("No active subscription")) {
        return errorResponse(
          "NO_SUBSCRIPTION",
          "No active subscription found",
          403,
        );
      }
      throw rpcError;
    }

    // The RPC returns an array with a single row
    const row = Array.isArray(result) ? result[0] : result;

    if (row?.status === "quota_exceeded") {
      return errorResponse(
        "QUOTA_EXCEEDED",
        `Evaluation limit reached (${row.evaluations_used}/${row.evaluation_limit}). Upgrade at https://llmassert.com/billing`,
        429,
        {
          evaluations_used: row.evaluations_used,
          evaluation_limit: row.evaluation_limit,
        },
      );
    }

    // 6. Non-blocking: update last_used_at after response
    after(async () => {
      await db
        .from("api_keys")
        .update({ last_used_at: new Date().toISOString() })
        .eq("id", apiKey.id);
    });

    // 7. Success
    return jsonResponse(
      {
        run_id: row.run_id,
        evaluations_ingested: row.evaluations_ingested,
        usage: {
          evaluations_used: row.evaluations_used,
          evaluation_limit: row.evaluation_limit,
        },
      },
      200,
    );
  } catch (error) {
    console.error("[ingest] Internal error:", error);
    return errorResponse("INTERNAL_ERROR", "Internal server error", 500);
  }
}
