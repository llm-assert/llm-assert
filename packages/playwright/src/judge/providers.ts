import OpenAI from "openai";

/** Minimal interface for pluggable LLM judge providers */
export interface JudgeProvider {
  readonly name: string;
  call(systemPrompt: string, userPrompt: string): Promise<string>;
}

/** OpenAI provider — uses chat.completions with JSON mode */
export class OpenAIProvider implements JudgeProvider {
  readonly name = "openai";
  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, model: string, timeout: number) {
    this.model = model;
    this.client = new OpenAI({
      apiKey,
      timeout,
      maxRetries: 0,
    });
  }

  async call(systemPrompt: string, userPrompt: string): Promise<string> {
    const completion = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: "developer", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) throw new Error("Empty response from OpenAI judge model");

    return content;
  }
}

/**
 * Anthropic provider — uses messages.create with top-level system param.
 * Loaded dynamically to keep @anthropic-ai/sdk optional.
 */
export class AnthropicProvider implements JudgeProvider {
  readonly name = "anthropic";
  private client: InstanceType<typeof import("@anthropic-ai/sdk").default>;
  private model: string;

  constructor(
    client: InstanceType<typeof import("@anthropic-ai/sdk").default>,
    model: string,
  ) {
    this.client = client;
    this.model = model;
  }

  async call(systemPrompt: string, userPrompt: string): Promise<string> {
    const message = await this.client.messages.create({
      model: this.model,
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const block = message.content[0];
    if (!block || block.type !== "text") {
      throw new Error("Empty response from Anthropic judge model");
    }

    const text = block.text;

    // Handle occasional preamble before JSON
    if (!text.trimStart().startsWith("{")) {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) return match[0];
    }

    return text;
  }
}

/**
 * Attempt to create an AnthropicProvider via dynamic import.
 * Returns null if the SDK is not installed or no API key is provided.
 */
export async function createAnthropicProvider(
  apiKey: string | undefined,
  model: string,
  timeout: number,
): Promise<AnthropicProvider | null> {
  if (!apiKey) return null;

  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({
      apiKey,
      timeout,
      maxRetries: 0,
    });
    return new AnthropicProvider(client, model);
  } catch {
    console.warn(
      "[LLMAssert] @anthropic-ai/sdk not installed. Anthropic fallback unavailable.",
    );
    return null;
  }
}
