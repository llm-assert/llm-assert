import { z } from "zod";

const ASSERTION_TYPES = [
  "groundedness",
  "pii",
  "sentiment",
  "schema",
  "fuzzy",
] as const;

const EVALUATION_RESULTS = ["pass", "fail", "inconclusive"] as const;

const FAILURE_REASONS = [
  "provider_error",
  "rate_limited",
  "timeout",
  "parse_error",
] as const;

const THRESHOLD_SOURCES = ["inline", "remote", "default"] as const;

const EvaluationSchema = z
  .object({
    assertion_type: z.enum(ASSERTION_TYPES),
    test_name: z.string().min(1).max(500),
    test_file: z.string().max(1000).optional(),
    input_text: z.string().min(1).max(50_000),
    context_text: z.string().max(100_000).optional(),
    expected_value: z.string().max(50_000).optional(),
    result: z.enum(EVALUATION_RESULTS),
    score: z.number().min(0).max(1).nullable(),
    reasoning: z.string().min(1).max(5000),
    judge_model: z.string().min(1).max(100),
    judge_latency_ms: z.number().int().nonnegative(),
    judge_input_tokens: z.number().int().positive().max(500_000).optional(),
    judge_output_tokens: z.number().int().positive().max(500_000).optional(),
    judge_cost_usd: z.number().nonnegative().max(100).optional(),
    fallback_used: z.boolean(),
    threshold: z.number().min(0).max(1),
    threshold_source: z.enum(THRESHOLD_SOURCES).optional(),
    input_truncated: z.boolean().optional(),
    injection_detected: z.boolean().optional(),
    rate_limited: z.boolean().optional(),
    judge_backoff_ms: z.number().nonnegative().optional(),
    failure_reason: z.enum(FAILURE_REASONS).nullable().optional(),
  })
  .refine((e) => e.result === "inconclusive" || e.score !== null, {
    message: "score must not be null unless result is inconclusive",
  });

export const IngestPayloadSchema = z.object({
  project_slug: z
    .string()
    .min(1)
    .max(100)
    .regex(
      /^[a-z0-9-]+$/,
      "project_slug must be lowercase alphanumeric with hyphens",
    ),
  run_id: z.string().uuid(),
  run: z.object({
    started_at: z.string().datetime(),
    finished_at: z.string().datetime().optional(),
    ci_provider: z.string().max(50).optional(),
    ci_run_url: z.string().url().max(2000).optional(),
    branch: z.string().max(500).optional(),
    commit_sha: z.string().max(100).optional(),
    metadata: z
      .record(z.string(), z.unknown())
      .refine((m) => Object.keys(m).length <= 50, {
        message: "metadata must have at most 50 keys",
      })
      .refine((m) => Buffer.byteLength(JSON.stringify(m), "utf8") <= 100_000, {
        message: "metadata must not exceed 100 KB when serialized",
      })
      .optional(),
    hardening_summary: z
      .object({
        total_input_rejected: z.number().nonnegative(),
        total_rate_limited: z.number().nonnegative(),
        total_backoff_ms: z.number().nonnegative(),
      })
      .optional(),
  }),
  evaluations: z.array(EvaluationSchema).min(1).max(500),
});

export type IngestPayload = z.infer<typeof IngestPayloadSchema>;
