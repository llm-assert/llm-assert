import type { JudgeConfig, JudgeResponse } from "../types.js";
import {
  type JudgeProvider,
  OpenAIProvider,
  createAnthropicProvider,
} from "./providers.js";

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
  }>;
}

export const DEFAULT_CONFIG: Required<
  Omit<JudgeConfig, "openaiApiKey" | "anthropicApiKey">
> = {
  primaryModel: "gpt-5.4-mini",
  fallbackModel: "claude-3-5-haiku-20241022",
  timeout: 10_000,
};

/**
 * Provider-agnostic judge client with fallback chain.
 * GPT-5.4-mini → Claude Haiku → inconclusive
 */
export class JudgeClient implements JudgeEvaluator {
  private config: Required<
    Omit<JudgeConfig, "openaiApiKey" | "anthropicApiKey">
  >;
  private providers: JudgeProvider[] = [];
  private anthropicInitPromise: Promise<void> | null = null;

  constructor(config: JudgeConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

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

  /** Evaluate with the judge model, returning score + reasoning */
  async evaluate(
    systemPrompt: string,
    userPrompt: string,
  ): Promise<{
    response: JudgeResponse;
    model: string;
    latencyMs: number;
    fallbackUsed: boolean;
  }> {
    // Ensure Anthropic provider is initialized before evaluating
    if (this.anthropicInitPromise) {
      await this.anthropicInitPromise;
    }

    const start = Date.now();

    for (let i = 0; i < this.providers.length; i++) {
      const provider = this.providers[i];
      try {
        const raw = await provider.call(systemPrompt, userPrompt);
        const response = this.parseResponse(raw);
        return {
          response,
          model: i === 0 ? this.config.primaryModel : this.config.fallbackModel,
          latencyMs: Date.now() - start,
          fallbackUsed: i > 0,
        };
      } catch (error) {
        const errorHint = error instanceof Error ? error.name : "Unknown error";
        if (i < this.providers.length - 1) {
          console.warn(
            `[LLMAssert] Primary judge (${provider.name}) failed (${errorHint}), trying fallback`,
          );
        }
      }
    }

    // All providers failed — return inconclusive
    // fallbackUsed is false: no provider produced a result
    return {
      response: {
        score: null,
        reasoning: "All judge providers unavailable. Marked as inconclusive.",
      },
      model: "none",
      latencyMs: Date.now() - start,
      fallbackUsed: false,
    };
  }

  private parseResponse(raw: string): JudgeResponse {
    try {
      const parsed = JSON.parse(raw);
      const score = Number(parsed.score);
      const reasoning = String(parsed.reasoning ?? "");

      // Only accept scores in [0, 1]. A model returning -1 is treated as a
      // parse failure (triggers fallback), not as the inconclusive sentinel.
      if (isNaN(score) || score < 0 || score > 1) {
        throw new Error(`Invalid score: ${parsed.score}`);
      }

      return { score, reasoning };
    } catch {
      throw new Error(`Failed to parse judge response: ${raw.slice(0, 200)}`);
    }
  }
}
