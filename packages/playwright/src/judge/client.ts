import OpenAI from "openai";
import type { JudgeConfig, JudgeResponse } from "../types.js";

const DEFAULT_CONFIG: Required<
  Omit<JudgeConfig, "openaiApiKey" | "anthropicApiKey">
> = {
  primaryModel: "gpt-5.4-mini",
  fallbackModel: "claude-haiku",
  timeout: 10_000,
};

/**
 * Provider-agnostic judge client with fallback chain.
 * GPT-5.4-mini → Claude Haiku → inconclusive
 */
export class JudgeClient {
  private config: Required<
    Omit<JudgeConfig, "openaiApiKey" | "anthropicApiKey">
  >;
  private openai: OpenAI | null;
  // TODO(FEAT-11): Add Anthropic client when implementing fallback

  constructor(config: JudgeConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    const openaiKey = config.openaiApiKey ?? process.env.OPENAI_API_KEY;
    this.openai = openaiKey
      ? new OpenAI({
          apiKey: openaiKey,
          timeout: this.config.timeout,
          maxRetries: 0,
        })
      : null;
  }

  /** Evaluate with the judge model, returning score + reasoning */
  async evaluate(
    systemPrompt: string,
    userPrompt: string,
  ): Promise<{
    response: JudgeResponse;
    model: string;
    latencyMs: number;
  }> {
    const start = Date.now();

    // Try primary model (OpenAI)
    if (this.openai) {
      try {
        const response = await this.callOpenAI(systemPrompt, userPrompt);
        return {
          response,
          model: this.config.primaryModel,
          latencyMs: Date.now() - start,
        };
      } catch (_error) {
        // Primary failed — fall through to fallback
      }
    }

    // TODO(FEAT-11): Try fallback model (Anthropic Claude Haiku)

    // Both providers failed — return inconclusive
    return {
      response: {
        score: -1,
        reasoning: "All judge providers unavailable. Marked as inconclusive.",
      },
      model: "none",
      latencyMs: Date.now() - start,
    };
  }

  private async callOpenAI(
    systemPrompt: string,
    userPrompt: string,
  ): Promise<JudgeResponse> {
    if (!this.openai) throw new Error("OpenAI client not initialized");

    const completion = await this.openai.chat.completions.create({
      model: this.config.primaryModel,
      messages: [
        { role: "developer", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) throw new Error("Empty response from judge model");

    return this.parseResponse(content);
  }

  private parseResponse(raw: string): JudgeResponse {
    try {
      const parsed = JSON.parse(raw);
      const score = Number(parsed.score);
      const reasoning = String(parsed.reasoning ?? "");

      if (isNaN(score) || score < 0 || score > 1) {
        throw new Error(`Invalid score: ${parsed.score}`);
      }

      return { score, reasoning };
    } catch {
      throw new Error(`Failed to parse judge response: ${raw.slice(0, 200)}`);
    }
  }
}
