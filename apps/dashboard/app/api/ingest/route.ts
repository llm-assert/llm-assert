import { createHash } from "node:crypto";
import { after } from "next/server";
import { revalidateTag } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { computeNextResetDate } from "@/lib/billing/reset-date";
import { checkRateLimit, getApiRateLimitConfig } from "@/lib/rate-limit";
import { createLogger } from "@/lib/logger";
import { IngestPayloadSchema } from "./schema";

const log = createLogger("ingest");

export const maxDuration = 30;

const INGEST_MAX_BODY_BYTES = 1_048_576; // 1 MB

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
    // 1. Content-Length fast-path size check (before auth, before body read)
    const contentLengthHeader = request.headers.get("content-length");
    if (
      contentLengthHeader != null &&
      Number(contentLengthHeader) > INGEST_MAX_BODY_BYTES
    ) {
      log.error(
        {
          event: "payload_too_large",
          contentLengthHeader: Number(contentLengthHeader),
          limitBytes: INGEST_MAX_BODY_BYTES,
        },
        "request body exceeds size limit (content-length)",
      );
      return errorResponse(
        "PAYLOAD_TOO_LARGE",
        "Request body exceeds 1 MB size limit",
        413,
        {
          max_bytes: INGEST_MAX_BODY_BYTES,
          actual_bytes: Number(contentLengthHeader),
        },
      );
    }

    // 2. Extract Bearer token
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return errorResponse("UNAUTHORIZED", "Missing or invalid API key", 401);
    }
    const token = authHeader.slice(7);
    if (!token) {
      return errorResponse("UNAUTHORIZED", "Missing or invalid API key", 401);
    }

    // 3. SHA-256 hash and lookup
    const keyHash = createHash("sha256").update(token).digest("hex");
    const db = supabaseAdmin();

    const { data: apiKey, error: keyError } = await db
      .from("api_keys")
      .select("id, project_id, user_id")
      .eq("key_hash", keyHash)
      .is("revoked_at", null)
      .single();

    if (keyError || !apiKey) {
      log.warn(
        { event: "auth_failure", keyPrefix: token.slice(0, 8) },
        "API key lookup failed",
      );
      return errorResponse("UNAUTHORIZED", "Missing or invalid API key", 401);
    }

    // 3b. Per-API-key rate limiting (check before body parse to save resources)
    const rateLimitResult = await checkRateLimit(
      `api:${apiKey.id}`,
      getApiRateLimitConfig(),
    );
    if (rateLimitResult.limited) {
      return new Response(
        JSON.stringify({ error: { code: "RATE_LIMITED", message: "Too many requests" } }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": String(rateLimitResult.retryAfterSeconds),
            ...CORS_HEADERS,
          },
        },
      );
    }

    // 4. Read body with size check, then parse JSON
    //    (replaces request.json() for size enforcement)
    let rawBody: string;
    try {
      rawBody = await request.text();
    } catch {
      return errorResponse(
        "INVALID_PAYLOAD",
        "Failed to read request body",
        400,
      );
    }

    const actualBytes = Buffer.byteLength(rawBody, "utf8");
    if (actualBytes > INGEST_MAX_BODY_BYTES) {
      log.error(
        {
          event: "payload_too_large",
          actualBytes,
          limitBytes: INGEST_MAX_BODY_BYTES,
          userId: apiKey.user_id,
          projectId: apiKey.project_id,
        },
        "request body exceeds size limit",
      );
      return errorResponse(
        "PAYLOAD_TOO_LARGE",
        "Request body exceeds 1 MB size limit",
        413,
        { max_bytes: INGEST_MAX_BODY_BYTES, actual_bytes: actualBytes },
      );
    }

    let body: unknown;
    try {
      body = JSON.parse(rawBody);
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

    // 5. Verify project slug matches API key's project
    const { data: project } = await db
      .from("projects")
      .select("slug")
      .eq("id", apiKey.project_id)
      .single();

    if (!project || project.slug !== payload.project_slug) {
      return errorResponse("PROJECT_NOT_FOUND", "Project not found", 404);
    }

    // 6. Atomic ingest: quota check + test_run upsert + evaluations insert
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
      log.error(
        {
          event: "batch_insert_error",
          keyPrefix: token.slice(0, 8),
          batchSize: payload.evaluations.length,
          runId: payload.run_id,
          errorCode: rpcError.code,
          errorMessage: rpcError.message,
        },
        "RPC ingest_test_run failed",
      );
      throw rpcError;
    }

    // The RPC returns an array with a single row
    const row = Array.isArray(result) ? result[0] : result;

    if (row?.status === "quota_exceeded") {
      // Query subscription for plan and reset date context (graceful degradation)
      const { data: sub, error: subError } = await db
        .from("subscriptions")
        .select("plan, current_period_end")
        .eq("user_id", apiKey.user_id)
        .eq("status", "active")
        .maybeSingle();

      if (subError) {
        log.error(
          {
            event: "subscription_query_error",
            userId: apiKey.user_id,
            errorMessage: subError.message,
          },
          "failed to query subscription for quota context",
        );
      }

      const plan = sub?.plan ?? "free";
      const nextResetDate = computeNextResetDate(
        plan,
        sub?.current_period_end ?? null,
      );

      log.warn(
        {
          event: "quota_exceeded",
          userId: apiKey.user_id,
          projectId: apiKey.project_id,
          plan,
          evaluationsUsed: row.evaluations_used,
          evaluationLimit: row.evaluation_limit,
          batchSize: payload.evaluations.length,
        },
        "evaluation quota exceeded",
      );

      // Bust subscription cache so dashboard reflects exhaustion immediately
      after(() => {
        revalidateTag(`subscription-${apiKey.user_id}`, "max");
      });

      return errorResponse(
        "QUOTA_EXCEEDED",
        `Evaluation limit reached (${row.evaluations_used}/${row.evaluation_limit}).`,
        429,
        {
          evaluations_used: row.evaluations_used,
          evaluation_limit: row.evaluation_limit,
          plan,
          next_reset_date: nextResetDate,
          upgrade_url: "https://llmassert.com/settings/billing",
        },
      );
    }

    // 7. Non-blocking: update last_used_at after response
    after(async () => {
      await db
        .from("api_keys")
        .update({ last_used_at: new Date().toISOString() })
        .eq("id", apiKey.id);
    });

    // 8. Success
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
    log.error({ err: error }, "internal error");
    return errorResponse("INTERNAL_ERROR", "Internal server error", 500);
  }
}
