/** Structured logger for LLMAssert hardening events */

export type LogEvent =
  | "input.rejected.too_long"
  | "input.rejected.injection_suspected"
  | "judge.rate_limited"
  | "judge.backoff"
  | "judge.provider_fallback"
  | "judge.parse_error"
  | "reporter.quota_exceeded"
  | "reporter.payload_too_large"
  | "reporter.preflight_ok"
  | "reporter.preflight_failed"
  | "reporter.preflight_skipped";

type LogLevel = "warn" | "error" | "debug";

const debugEnabled = process.env.LLMASSERT_DEBUG === "1";

export function log(
  level: LogLevel,
  event: LogEvent,
  fields: Record<string, unknown> = {},
): void {
  if (level === "debug" && !debugEnabled) return;

  const entry = {
    level,
    event,
    timestamp: new Date().toISOString(),
    ...fields,
  };

  process.stderr.write(JSON.stringify(entry) + "\n");
}
