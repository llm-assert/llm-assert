/** Result returned by all LLMAssert assertion matchers */
export interface AssertionResult {
  /** Whether the assertion passed */
  pass: boolean
  /** Numeric score from 0.0 (worst) to 1.0 (best) */
  score: number
  /** Judge model's explanation of the score */
  reasoning: string
}

/** Judge model response shape — all prompts request this format */
export interface JudgeResponse {
  score: number
  reasoning: string
}

/** Supported assertion types */
export type AssertionType =
  | 'groundedness'
  | 'pii'
  | 'sentiment'
  | 'schema'
  | 'fuzzy'

/** Result status for evaluations */
export type EvaluationResult = 'pass' | 'fail' | 'inconclusive'

/** Configuration for the LLMAssert judge */
export interface JudgeConfig {
  /** Primary model to use (default: 'gpt-5.4-mini') */
  primaryModel?: string
  /** Fallback model (default: 'claude-haiku') */
  fallbackModel?: string
  /** Timeout in milliseconds before marking inconclusive (default: 10000) */
  timeout?: number
  /** OpenAI API key (default: process.env.OPENAI_API_KEY) */
  openaiApiKey?: string
  /** Anthropic API key (default: process.env.ANTHROPIC_API_KEY) */
  anthropicApiKey?: string
}

/** Configuration for the custom Playwright reporter */
export interface ReporterConfig {
  /** API key for the LLMAssert dashboard */
  apiKey?: string
  /** Project slug on the dashboard */
  projectSlug: string
  /** Dashboard URL (default: 'https://llmassert.com') */
  dashboardUrl?: string
  /** Evaluations per request (default: 50) */
  batchSize?: number
  /** Ingest request timeout in ms (default: 10000) */
  timeout?: number
  /** Retry count on network failure (default: 1) */
  retries?: number
  /** Error handling mode (default: 'warn') */
  onError?: 'warn' | 'throw' | 'silent'
  /** Arbitrary metadata attached to the run */
  metadata?: Record<string, string>
}

/** A single evaluation result collected by the reporter */
export interface EvaluationRecord {
  assertionType: AssertionType
  testName: string
  testFile?: string
  inputText: string
  contextText?: string
  expectedValue?: string
  result: EvaluationResult
  score: number
  reasoning: string
  judgeModel: string
  judgeLatencyMs: number
  judgeCostUsd?: number
}

/** Payload sent to POST /api/ingest */
export interface IngestPayload {
  project_slug: string
  run: {
    started_at: string
    finished_at?: string
    ci_provider?: string
    ci_run_url?: string
    branch?: string
    commit_sha?: string
  }
  evaluations: Array<{
    assertion_type: string
    test_name: string
    test_file?: string
    input_text: string
    context_text?: string
    expected_value?: string
    result: EvaluationResult
    score: number
    reasoning: string
    judge_model: string
    judge_latency_ms: number
    judge_cost_usd?: number
  }>
}
