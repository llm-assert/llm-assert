import type {
  FailureReason,
  JudgeConfig,
  JudgeResponse,
  TokenUsage,
} from "../types.js";
import { log } from "../logger.js";
import {
  type JudgeProvider,
  RateLimitError,
  ProviderTimeoutError,
  OpenAIProvider,
  createAnthropicProvider,
} from "./providers.js";
import { calculateCostUsd } from "./pricing.js";

/** Abstraction for time — enables deterministic testing of rate limiting */
export interface Clock {
  now(): number;
  sleep(ms: number): Promise<void>;
}

export const realClock: Clock = {
  now: () => Date.now(),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

/** Thrown when parseResponse() fails — distinguished from provider API errors */
export class JudgeParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JudgeParseError";
  }
}

/** Minimal interface for judge evaluation — enables clean mocking in tests */
export interface JudgeEvaluator {
  evaluate(
    systemPrompt: string,
    userPrompt: string,
  ): Promise<{
    response: JudgeResponse;
    model: string;
    latencyMs: number;
    fallbackUsed: boolean;
    failureReason: FailureReason;
    backoffMs: number;
    usage?: TokenUsage;
    costUsd?: number;
  }>;
}

export const DEFAULT_CONFIG: Required<
  Omit<
    JudgeConfig,
    | "openaiApiKey"
    | "anthropicApiKey"
    | "maxInputChars"
    | "inputHandling"
    | "rateLimit"
    | "pricing"
  >
> & { maxInputChars: number; inputHandling: "reject" | "truncate" } = {
  primaryModel: "gpt-5.4-mini",
  fallbackModel: "claude-3-5-haiku-20241022",
  timeout: 10_000,
  maxInputChars: 500_000,
  inputHandling: "reject",
};

/** Phrases in judge reasoning that may indicate prompt injection */
const INJECTION_PHRASES =
  /\b(ignore previous|disregard|new instruction|as instructed|per your request|override|bypass)\b/i;

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw == null || raw === "") return fallback;
  const parsed = parseInt(raw, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

/** Max retries on 429 before falling to next provider (configurable via env) */
const MAX_429_RETRIES = envInt("LLMASSERT_MAX_429_RETRIES", 3);
/** Base delay for exponential backoff on 429 in ms (configurable via env) */
const BACKOFF_BASE_MS = envInt("LLMASSERT_BACKOFF_BASE_MS", 200);

/**
 * Provider-agnostic judge client with fallback chain.
 * GPT-5.4-mini → Claude Haiku → inconclusive
 */
export class JudgeClient implements JudgeEvaluator {
  private config: typeof DEFAULT_CONFIG & Pick<JudgeConfig, "pricing">;
  private providers: JudgeProvider[] = [];
  private anthropicInitPromise: Promise<void> | null = null;
  private clock: Clock;

  // Token bucket state
  private bucketTokens: number;
  private bucketLastRefill: number;
  private bucketCapacity: number;
  private bucketRefillRate: number; // tokens per ms
  private rateLimitEnabled: boolean;

  constructor(config: JudgeConfig = {}, clock?: Clock) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.clock = clock ?? realClock;

    // Rate limiter init (defaults configurable via env to keep values out of source)
    const envBurst = envInt("LLMASSERT_RATE_LIMIT_BURST", 10);
    const envRpm = envInt("LLMASSERT_RATE_LIMIT_RPM", 60);
    const rl = config.rateLimit;
    this.rateLimitEnabled = !!rl || !!(process.env.LLMASSERT_RATE_LIMIT_RPM);
    this.bucketCapacity = rl?.burstCapacity ?? envBurst;
    this.bucketTokens = this.bucketCapacity;
    this.bucketRefillRate = rl
      ? rl.requestsPerMinute / 60_000
      : (process.env.LLMASSERT_RATE_LIMIT_RPM ? envRpm / 60_000 : 0);
    this.bucketLastRefill = this.clock.now();

    // Primary: OpenAI (sync init)
    const openaiKey = config.openaiApiKey ?? process.env.OPENAI_API_KEY;
    if (openaiKey) {
      this.providers.push(
        new OpenAIProvider(
          openaiKey,
          this.config.primaryModel,
          this.config.timeout,
        ),
      );
    }

    // Fallback: Anthropic (async lazy init)
    const anthropicKey =
      config.anthropicApiKey ?? process.env.ANTHROPIC_API_KEY;
    this.anthropicInitPromise = createAnthropicProvider(
      anthropicKey,
      this.config.fallbackModel,
      this.config.timeout,
    ).then((provider) => {
      if (provider) this.providers.push(provider);
      this.anthropicInitPromise = null;
    });
  }

  /** Reset rate limiter state — for testing only */
  resetForTesting(): void {
    this.bucketTokens = this.bucketCapacity;
    this.bucketLastRefill = this.clock.now();
  }

  /** Wait for a rate limit token if rate limiting is enabled */
  private async acquireToken(): Promise<void> {
    if (!this.rateLimitEnabled) return;

    // Refill tokens based on elapsed time
    const now = this.clock.now();
    const elapsed = now - this.bucketLastRefill;
    this.bucketTokens = Math.min(
      this.bucketCapacity,
      this.bucketTokens + elapsed * this.bucketRefillRate,
    );
    this.bucketLastRefill = now;

    if (this.bucketTokens >= 1) {
      this.bucketTokens -= 1;
      return;
    }

    // Wait for next token
    const waitMs = Math.ceil((1 - this.bucketTokens) / this.bucketRefillRate);
    log("debug", "judge.backoff", { waitMs, source: "token_bucket" });
    await this.clock.sleep(waitMs);
    this.bucketTokens = 0; // consumed the token we waited for
    this.bucketLastRefill = this.clock.now();
  }

  /** Evaluate with the judge model, returning score + reasoning */
  async evaluate(
    systemPrompt: string,
    userPrompt: string,
  ): Promise<{
    response: JudgeResponse;
    model: string;
    latencyMs: number;
    fallbackUsed: boolean;
    failureReason: FailureReason;
    backoffMs: number;
    usage?: TokenUsage;
    costUsd?: number;
  }> {
    // Ensure Anthropic provider is initialized before evaluating
    if (this.anthropicInitPromise) {
      await this.anthropicInitPromise;
    }

    // Acquire rate limit token
    await this.acquireToken();

    const start = this.clock.now();
    let totalBackoffMs = 0;
    let lastFailureReason: FailureReason = null;

    for (let i = 0; i < this.providers.length; i++) {
      const provider = this.providers[i];
      let lastRaw:
        | { text: string; backoffMs: number; usage?: TokenUsage }
        | undefined;
      try {
        const raw = await this.callWithRetry(
          provider,
          systemPrompt,
          userPrompt,
        );
        lastRaw = raw;
        totalBackoffMs += raw.backoffMs;
        const response = this.parseResponse(raw.text);
        const model =
          i === 0 ? this.config.primaryModel : this.config.fallbackModel;
        const costUsd = raw.usage
          ? (calculateCostUsd(model, raw.usage, this.config.pricing) ??
            undefined)
          : undefined;
        return {
          response,
          model,
          latencyMs: this.clock.now() - start,
          fallbackUsed: i > 0,
          failureReason: null,
          backoffMs: totalBackoffMs,
          usage: raw.usage,
          costUsd,
        };
      } catch (error) {
        if (error instanceof JudgeParseError) {
          // Parse errors do NOT trigger fallback — return inconclusive immediately
          log("warn", "judge.parse_error", {
            provider: provider.name,
            error: error.message,
          });
          const parseModel =
            i === 0 ? this.config.primaryModel : this.config.fallbackModel;
          const parseCost = lastRaw?.usage
            ? (calculateCostUsd(
                parseModel,
                lastRaw.usage,
                this.config.pricing,
              ) ?? undefined)
            : undefined;
          return {
            response: {
              score: null,
              reasoning: `Judge response parsing failed: ${error.message}`,
            },
            model: parseModel,
            latencyMs: this.clock.now() - start,
            fallbackUsed: i > 0,
            failureReason: "parse_error",
            backoffMs: totalBackoffMs,
            usage: lastRaw?.usage,
            costUsd: parseCost,
          };
        }

        // Track backoff from retry attempts and classify failure reason
        if (error instanceof RetryExhaustedError) {
          totalBackoffMs += error.totalBackoffMs;
          lastFailureReason = "rate_limited";
        } else if (error instanceof ProviderTimeoutError) {
          lastFailureReason = "timeout";
        } else {
          lastFailureReason = "provider_error";
        }

        const errorHint = error instanceof Error ? error.name : "Unknown error";
        if (i < this.providers.length - 1) {
          log("warn", "judge.provider_fallback", {
            provider: provider.name,
            error: errorHint,
          });
          console.warn(
            `[LLMAssert] Primary judge (${provider.name}) failed (${errorHint}), trying fallback`,
          );
        }
      }
    }

    // All providers failed — return inconclusive
    return {
      response: {
        score: null,
        reasoning: "All judge providers unavailable. Marked as inconclusive.",
      },
      model: "none",
      latencyMs: this.clock.now() - start,
      fallbackUsed: false,
      failureReason: lastFailureReason ?? "provider_error",
      backoffMs: totalBackoffMs,
    };
  }

  /** Call a provider with 429 retry and exponential backoff */
  private async callWithRetry(
    provider: JudgeProvider,
    systemPrompt: string,
    userPrompt: string,
  ): Promise<{ text: string; backoffMs: number; usage?: TokenUsage }> {
    let totalBackoffMs = 0;

    for (let attempt = 0; attempt <= MAX_429_RETRIES; attempt++) {
      try {
        const result = await provider.call(systemPrompt, userPrompt);
        return {
          text: result.text,
          backoffMs: totalBackoffMs,
          usage: result.usage,
        };
      } catch (error) {
        if (error instanceof RateLimitError && attempt < MAX_429_RETRIES) {
          const delay =
            BACKOFF_BASE_MS * Math.pow(2, attempt) +
            Math.floor(Math.random() * 100);
          log("warn", "judge.rate_limited", {
            provider: provider.name,
            attempt: attempt + 1,
            delayMs: delay,
          });
          await this.clock.sleep(delay);
          totalBackoffMs += delay;
          continue;
        }
        if (error instanceof RateLimitError) {
          throw new RetryExhaustedError(provider.name, totalBackoffMs);
        }
        throw error;
      }
    }

    // Should not reach here
    throw new RetryExhaustedError(provider.name, totalBackoffMs);
  }

  private parseResponse(raw: string): JudgeResponse {
    try {
      const parsed = JSON.parse(raw);
      const score = Number(parsed.score);
      let reasoning = String(parsed.reasoning ?? "");

      // Cap reasoning length and strip control characters
      if (reasoning.length > 1000) {
        reasoning = reasoning.slice(0, 1000);
      }
      reasoning = reasoning.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, "");

      // Advisory log for injection-indicator phrases in reasoning
      if (INJECTION_PHRASES.test(reasoning)) {
        log("warn", "input.rejected.injection_suspected", {
          source: "reasoning",
          snippet: reasoning.slice(0, 100),
        });
      }

      if (isNaN(score) || score < 0 || score > 1) {
        throw new JudgeParseError(`Invalid score: ${parsed.score}`);
      }

      return { score, reasoning };
    } catch (error) {
      if (error instanceof JudgeParseError) throw error;
      throw new JudgeParseError(
        `Failed to parse judge response: ${raw.slice(0, 200)}`,
      );
    }
  }
}

/** Internal error for when all 429 retries are exhausted */
class RetryExhaustedError extends Error {
  readonly totalBackoffMs: number;
  constructor(providerName: string, totalBackoffMs: number) {
    super(`All 429 retries exhausted for ${providerName}`);
    this.name = "RetryExhaustedError";
    this.totalBackoffMs = totalBackoffMs;
  }
}
