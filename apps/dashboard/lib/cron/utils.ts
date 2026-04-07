import { timingSafeEqual } from "node:crypto";
import { serverEnv } from "@/lib/env.server";

/**
 * Timing-safe comparison of the Authorization header against the expected
 * Bearer ${CRON_SECRET} token. Returns false (rather than throwing) on
 * length mismatch or missing header/env var.
 */
export function verifyCronSecret(request: Request): boolean {
  const cronSecret = serverEnv.CRON_SECRET;
  if (!cronSecret) return false;

  const authHeader = request.headers.get("authorization");
  if (!authHeader) return false;

  const a = Buffer.from(`Bearer ${cronSecret}`);
  const b = Buffer.from(authHeader);
  if (a.byteLength !== b.byteLength) return false;

  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Emit a structured JSON log entry for cron operations.
 * Events matching "error" or "auth_failure" go to stderr; all others to stdout.
 */
export function logCron(
  source: string,
  event: string,
  details?: Record<string, unknown>,
): void {
  const entry = {
    source,
    event,
    ...details,
  };
  if (event === "error" || event === "auth_failure") {
    console.error(JSON.stringify(entry));
  } else {
    console.log(JSON.stringify(entry));
  }
}
