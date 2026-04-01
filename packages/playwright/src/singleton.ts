import type { JudgeEvaluator } from "./judge/client.js";

/**
 * Module-level singleton for the worker-scoped JudgeClient.
 *
 * Safe because Playwright workers are separate OS processes —
 * module-level state is worker-isolated by design.
 *
 * Set by the auto worker fixture in fixtures.ts.
 * Read by matchers in index.ts to avoid constructing a new client per call.
 */
let _workerJudgeClient: JudgeEvaluator | null = null;

export function getWorkerJudgeClient(): JudgeEvaluator | null {
  return _workerJudgeClient;
}

export function setWorkerJudgeClient(client: JudgeEvaluator | null): void {
  _workerJudgeClient = client;
}
