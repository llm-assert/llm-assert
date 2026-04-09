import { resolveAuth, resolveProject, AuthError } from "@/lib/api/auth";
import { success, error, OPTIONS as corsOptions } from "@/lib/api/response";
import { checkRateLimit, getPreflightRateLimitConfig, getClientIp } from "@/lib/rate-limit";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createLogger } from "@/lib/logger";

const log = createLogger("ingest/preflight");

export const maxDuration = 5;

export function OPTIONS(): Response {
  return corsOptions();
}

export async function GET(request: Request): Promise<Response> {
  try {
    // IP-based rate limiting (before auth to prevent key-validity oracle abuse)
    const clientIp = getClientIp(request);
    if (clientIp === "unknown") {
      log.warn({ event: "unknown_client_ip" }, "could not determine client IP");
    }
    const rateLimitResult = await checkRateLimit(
      `preflight:${clientIp}`,
      getPreflightRateLimitConfig(),
    );
    if (rateLimitResult.limited) {
      return new Response(
        JSON.stringify({ error: { code: "RATE_LIMITED", message: "Too many requests" } }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": String(rateLimitResult.retryAfterSeconds),
            "Access-Control-Allow-Origin": "*",
          },
        },
      );
    }

    const auth = await resolveAuth(request);

    const url = new URL(request.url);
    const projectSlug = url.searchParams.get("project_slug");
    if (!projectSlug) {
      return error(
        "INVALID_REQUEST",
        "Missing required query parameter: project_slug",
        400,
      );
    }

    const project = await resolveProject(projectSlug, auth);

    const db = supabaseAdmin();
    const { data: subscription } = await db
      .from("subscriptions")
      .select("evaluations_used, evaluation_limit, plan")
      .eq("user_id", auth.userId)
      .eq("status", "active")
      .maybeSingle();

    if (!subscription) {
      return success(
        {
          status: "quota_exceeded",
          project: { slug: project.slug, name: project.name },
          quota: {
            evaluations_used: 0,
            evaluation_limit: 0,
            plan: "none",
          },
        },
        { cors: true },
      );
    }

    const { evaluations_used, evaluation_limit, plan } = subscription;
    const usageRatio =
      evaluation_limit > 0 ? evaluations_used / evaluation_limit : 1;

    let status: "ok" | "quota_warning" | "quota_exceeded";
    if (usageRatio >= 1) {
      status = "quota_exceeded";
    } else if (usageRatio >= 0.8) {
      status = "quota_warning";
    } else {
      status = "ok";
    }

    return success(
      {
        status,
        project: { slug: project.slug, name: project.name },
        quota: { evaluations_used, evaluation_limit, plan },
      },
      { cors: true },
    );
  } catch (err) {
    if (err instanceof AuthError) {
      return error(err.code, err.message, err.status);
    }
    log.error({ err }, "internal error");
    return error("INTERNAL_ERROR", "Internal server error", 500);
  }
}
