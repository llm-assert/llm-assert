import { randomUUID } from "node:crypto";
import { IngestPayloadSchema } from "@/app/api/ingest/schema";
import { generateApiKey } from "@/lib/api-keys";

type Evaluation = {
  assertion_type: string;
  test_name: string;
  test_file?: string;
  input_text: string;
  context_text?: string;
  expected_value?: string;
  result: string;
  score: number | null;
  reasoning: string;
  judge_model: string;
  judge_latency_ms: number;
  judge_cost_usd?: number;
  fallback_used: boolean;
  threshold: number;
  input_truncated?: boolean;
  injection_detected?: boolean;
  rate_limited?: boolean;
  judge_backoff_ms?: number;
  failure_reason?: string | null;
};

const EVALUATION_DEFAULTS: Evaluation = {
  assertion_type: "groundedness",
  test_name: "should be grounded in context",
  test_file: "tests/example.spec.ts",
  input_text: "The capital of France is Paris.",
  context_text: "Paris is the capital and most populous city of France.",
  result: "pass",
  score: 0.95,
  reasoning: "The response is fully supported by the provided context.",
  judge_model: "gpt-5.4-mini",
  judge_latency_ms: 450,
  judge_cost_usd: 0.0003,
  fallback_used: false,
  threshold: 0.7,
  input_truncated: false,
  injection_detected: false,
  rate_limited: false,
};

export function buildEvaluation(overrides?: Partial<Evaluation>): Evaluation {
  return { ...EVALUATION_DEFAULTS, ...overrides };
}

export function buildIngestPayload(
  overrides?: Partial<{
    project_slug: string;
    run_id: string;
    run: Record<string, unknown>;
    evaluations: Partial<Evaluation>[];
  }>,
) {
  const now = new Date().toISOString();
  return {
    project_slug: overrides?.project_slug ?? "my-project",
    run_id: overrides?.run_id ?? randomUUID(),
    run: {
      started_at: now,
      finished_at: now,
      ...overrides?.run,
    },
    evaluations: (overrides?.evaluations ?? [{}]).map((e) =>
      buildEvaluation(e),
    ),
  };
}

/** Self-validate: factory defaults must pass the schema. */
export function assertFactoryDefaults(): void {
  IngestPayloadSchema.parse(buildIngestPayload());
}

export function buildApiKeyRecord(overrides?: { label?: string }) {
  const key = generateApiKey();
  return {
    raw: key.raw,
    hash: key.hash,
    prefix: key.prefix,
    label: overrides?.label ?? `test-key-${randomUUID().slice(0, 8)}`,
  };
}
