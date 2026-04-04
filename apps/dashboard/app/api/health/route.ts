import { OPTIONS as corsOptions } from "@/lib/api/response";

// Health probe — intentionally unauthenticated. Do not add resolveAuth().
export const maxDuration = 5;

export function OPTIONS(): Response {
  return corsOptions();
}

type DbCheckResult =
  | { status: "ok"; latencyMs: number }
  | { status: "error" }
  | { status: "timeout" }
  | { status: "misconfigured" };

async function checkDatabase(): Promise<DbCheckResult> {
  try {
    const { supabaseAdmin } = await import("@/lib/supabase/admin");
    const db = supabaseAdmin();

    const start = performance.now();
    const result = await Promise.race([
      db.from("projects").select("id").limit(1),
      new Promise<"timeout">((resolve) =>
        setTimeout(() => resolve("timeout"), 3000),
      ),
    ]);

    if (result === "timeout") {
      return { status: "timeout" };
    }

    const latencyMs = Math.round(performance.now() - start);

    if (result.error) {
      console.warn("[api/health] DB check error:", result.error);
      return { status: "error" };
    }

    return { status: "ok", latencyMs };
  } catch (e) {
    console.warn("[api/health] DB check failed:", e);
    return { status: "misconfigured" };
  }
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const mode = url.searchParams.get("mode");
  const isDeep = mode === "deep";

  const version = process.env.npm_package_version ?? null;
  const commit = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null;
  const timestamp = new Date().toISOString();

  if (!isDeep) {
    return Response.json(
      { status: "healthy", version, commit, timestamp },
      {
        headers: {
          "Cache-Control":
            "public, max-age=10, s-maxage=10, stale-while-revalidate=5",
        },
      },
    );
  }

  // Deep check: verify DB connectivity
  const db = await checkDatabase();

  const status =
    db.status === "ok"
      ? "healthy"
      : db.status === "error"
        ? "unhealthy"
        : "degraded";

  const httpStatus = status === "unhealthy" ? 503 : 200;

  return Response.json(
    { status, version, commit, timestamp, checks: { db } },
    {
      status: httpStatus,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
