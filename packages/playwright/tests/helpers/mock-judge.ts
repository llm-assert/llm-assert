import type { JudgeEvaluator } from "../../src/judge/client.js";
import type {
  FailureReason,
  JudgeResponse,
  TokenUsage,
} from "../../src/types.js";

interface MockJudgeOptions {
  score: number | null;
  reasoning?: string;
  model?: string;
  latencyMs?: number;
  fallbackUsed?: boolean;
  failureReason?: FailureReason;
  backoffMs?: number;
  usage?: TokenUsage;
  costUsd?: number;
}

export function createMockJudge(options: MockJudgeOptions): JudgeEvaluator {
  return {
    async evaluate(): Promise<{
      response: JudgeResponse;
      model: string;
      latencyMs: number;
      fallbackUsed: boolean;
      failureReason: FailureReason;
      backoffMs: number;
      usage?: TokenUsage;
      costUsd?: number;
    }> {
      return {
        response: {
          score: options.score,
          reasoning: options.reasoning ?? "Mock reasoning",
        },
        model: options.model ?? "mock",
        latencyMs: options.latencyMs ?? 0,
        fallbackUsed: options.fallbackUsed ?? false,
        failureReason: options.failureReason ?? null,
        backoffMs: options.backoffMs ?? 0,
        usage: options.usage,
        costUsd: options.costUsd,
      };
    },
  };
}

export function mockPassingJudge(): JudgeEvaluator {
  return createMockJudge({ score: 0.9, reasoning: "Mock pass" });
}

export function mockFailingJudge(): JudgeEvaluator {
  return createMockJudge({ score: 0.2, reasoning: "Mock fail" });
}

export function mockInconclusiveJudge(): JudgeEvaluator {
  return createMockJudge({ score: null, reasoning: "Mock inconclusive" });
}

/** Mock judge that captures the prompts passed to evaluate() for assertion */
export function capturePromptJudge(
  options: MockJudgeOptions = { score: 0.9 },
): {
  judge: JudgeEvaluator;
  calls: Array<{ systemPrompt: string; userPrompt: string }>;
} {
  const calls: Array<{ systemPrompt: string; userPrompt: string }> = [];
  const judge: JudgeEvaluator = {
    async evaluate(systemPrompt: string, userPrompt: string) {
      calls.push({ systemPrompt, userPrompt });
      return {
        response: {
          score: options.score,
          reasoning: options.reasoning ?? "Mock reasoning",
        },
        model: options.model ?? "mock",
        latencyMs: options.latencyMs ?? 0,
        fallbackUsed: options.fallbackUsed ?? false,
        failureReason: options.failureReason ?? null,
        backoffMs: options.backoffMs ?? 0,
        usage: options.usage,
        costUsd: options.costUsd,
      };
    },
  };
  return { judge, calls };
}
