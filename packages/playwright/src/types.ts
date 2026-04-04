/** Result returned by all LLMAssert assertion matchers */
export interface AssertionResult {
  /** Whether the assertion passed */
  pass: boolean;
  /** Numeric score from 0.0 (worst) to 1.0 (best), or null if inconclusive */
  score: number | null;
  /** Judge model's explanation of the score */
  reasoning: string;
}

/** Source of the effective threshold used for an evaluation */
export type ThresholdSource = "inline" | "remote" | "default";

/** Extended assertion result with hardening metadata from judge evaluation */
export type HardenedResult = AssertionResult & {
  model: string;
  latencyMs: number;
  fallbackUsed: boolean;
  thresholdSource?: ThresholdSource;
  inputTruncated?: boolean;
  injectionDetected?: boolean;
  rateLimited?: boolean;
  judgeBackoffMs?: number;
  failureReason?: FailureReason;
};

/** Judge model response shape — all prompts request this format */
export interface JudgeResponse {
  score: number | null;
  reasoning: string;
}

/** Supported assertion types */
export type AssertionType =
  | "groundedness"
  | "pii"
  | "sentiment"
  | "schema"
  | "fuzzy";

/** Result status for evaluations */
export type EvaluationResult = "pass" | "fail" | "inconclusive";

/** Reason why an evaluation failed or returned inconclusive */
export type FailureReason =
  | "provider_error"
  | "rate_limited"
  | "timeout"
  | "parse_error"
  | null;

/** Configuration for the LLMAssert judge */
export interface JudgeConfig {
  /** Primary model to use (default: 'gpt-5.4-mini') */
  primaryModel?: string;
  /** Fallback model (default: 'claude-3-5-haiku-20241022') */
  fallbackModel?: string;
  /** Timeout in milliseconds before marking inconclusive (default: 10000) */
  timeout?: number;
  /** OpenAI API key (default: process.env.OPENAI_API_KEY) */
  openaiApiKey?: string;
  /** Anthropic API key (default: process.env.ANTHROPIC_API_KEY) */
  anthropicApiKey?: string;
  /** Maximum combined input character length before rejection/truncation (default: 500000) */
  maxInputChars?: number;
  /** How to handle inputs exceeding maxInputChars (default: 'reject') */
  inputHandling?: "reject" | "truncate";
  /** Rate limiting configuration for judge API calls */
  rateLimit?: {
    /** Maximum requests per minute per worker (default: 60) */
    requestsPerMinute: number;
    /** Maximum burst capacity (default: 10) */
    burstCapacity: number;
  };
}

/** Configuration for the custom Playwright reporter */
export interface ReporterConfig {
  /** API key for the LLMAssert dashboard */
  apiKey?: string;
  /** Project slug on the dashboard */
  projectSlug: string;
  /** Dashboard URL (default: 'https://llmassert.com') */
  dashboardUrl?: string;
  /** Evaluations per request (default: 50) */
  batchSize?: number;
  /** Ingest request timeout in ms (default: 10000) */
  timeout?: number;
  /** Retry count on network failure (default: 1) */
  retries?: number;
  /** Error handling mode (default: 'warn') */
  onError?: "warn" | "throw" | "silent";
  /** Error handling mode for threshold fetch failures (default: 'warn') */
  onThresholdFetchError?: "warn" | "throw" | "silent";
  /** Arbitrary metadata attached to the run */
  metadata?: Record<string, unknown>;
}

/** A single evaluation result collected by the reporter */
export interface EvaluationRecord {
  assertionType: AssertionType;
  testName: string;
  testFile?: string;
  inputText: string;
  contextText?: string;
  expectedValue?: string;
  result: EvaluationResult;
  score: number | null;
  reasoning: string;
  judgeModel: string;
  judgeLatencyMs: number;
  judgeCostUsd?: number;
  /** Whether a fallback provider was used instead of the primary */
  fallbackUsed: boolean;
  /** Effective pass/fail threshold used by the matcher */
  threshold: number;
  /** Source of the effective threshold: inline override, remote dashboard, or default */
  thresholdSource?: ThresholdSource;
  /** Whether input was truncated before sending to the judge */
  inputTruncated?: boolean;
  /** Whether prompt injection control sequences were detected and stripped */
  injectionDetected?: boolean;
  /** Whether rate limit backoff was incurred during evaluation */
  rateLimited?: boolean;
  /** Total milliseconds spent in rate limit backoff */
  judgeBackoffMs?: number;
  /** Reason for failure or inconclusive result */
  failureReason?: FailureReason;
}

/** Fixture options configurable via playwright.config.ts use: { judgeConfig: {...} } */
export interface LLMAssertOptions {
  judgeConfig: Partial<JudgeConfig>;
}

/** Test fixture exposing resolved judge configuration */
export interface LLMAssertFixture {
  readonly judgeConfig: JudgeConfig;
}

/** Remote thresholds fetched from the dashboard API, keyed by assertion type */
export type RemoteThresholds = Partial<Record<AssertionType, number>> | null;

/** Payload sent to POST /api/ingest */
export interface IngestPayload {
  project_slug: string;
  run_id: string;
  run: {
    started_at: string;
    finished_at?: string;
    ci_provider?: string;
    ci_run_url?: string;
    branch?: string;
    commit_sha?: string;
    metadata?: Record<string, unknown>;
    hardening_summary?: {
      total_input_rejected: number;
      total_rate_limited: number;
      total_backoff_ms: number;
    };
  };
  evaluations: Array<{
    assertion_type: string;
    test_name: string;
    test_file?: string;
    input_text: string;
    context_text?: string;
    expected_value?: string;
    result: EvaluationResult;
    score: number | null;
    reasoning: string;
    judge_model: string;
    judge_latency_ms: number;
    judge_cost_usd?: number;
    fallback_used: boolean;
    threshold: number;
    threshold_source?: ThresholdSource;
    input_truncated?: boolean;
    injection_detected?: boolean;
    rate_limited?: boolean;
    judge_backoff_ms?: number;
    failure_reason?: FailureReason;
  }>;
}
