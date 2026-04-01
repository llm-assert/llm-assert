import type { JudgeEvaluator } from "../../src/judge/client.js";
import type { JudgeResponse } from "../../src/types.js";

interface MockJudgeOptions {
  score: number;
  reasoning?: string;
  model?: string;
  latencyMs?: number;
  fallbackUsed?: boolean;
}

export function createMockJudge(options: MockJudgeOptions): JudgeEvaluator {
  return {
    async evaluate(): Promise<{
      response: JudgeResponse;
      model: string;
      latencyMs: number;
      fallbackUsed: boolean;
    }> {
      return {
        response: {
          score: options.score,
          reasoning: options.reasoning ?? "Mock reasoning",
        },
        model: options.model ?? "mock",
        latencyMs: options.latencyMs ?? 0,
        fallbackUsed: options.fallbackUsed ?? false,
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
  return createMockJudge({ score: -1, reasoning: "Mock inconclusive" });
}
