import type {
  AssertionType,
  RemoteThresholds,
  ThresholdSource,
} from "../types.js";

const FETCH_TIMEOUT_MS = 3_000;

export interface ThresholdFetchConfig {
  dashboardUrl: string;
  apiKey: string;
  projectSlug: string;
}

/**
 * Fetches project thresholds from the LLMAssert dashboard API.
 *
 * Returns a partial record of assertion-type → threshold value,
 * or null if the fetch fails or is not configured.
 */
export class ThresholdClient {
  private config: ThresholdFetchConfig;

  constructor(config: ThresholdFetchConfig) {
    this.config = config;
  }

  async fetch(): Promise<RemoteThresholds> {
    const url = `${this.config.dashboardUrl}/api/projects/${encodeURIComponent(this.config.projectSlug)}/thresholds`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new Error(
        `Threshold fetch failed: ${response.status} ${response.statusText}`,
      );
    }

    const body = (await response.json()) as {
      data?: Record<string, number>;
    };

    if (!body.data || typeof body.data !== "object") {
      throw new Error("Threshold fetch returned invalid response shape");
    }

    return body.data as RemoteThresholds;
  }
}

// ---------------------------------------------------------------------------
// Module-level singleton for worker-scoped threshold cache
// ---------------------------------------------------------------------------

let _workerThresholds: RemoteThresholds = null;

export function getWorkerThresholds(): RemoteThresholds {
  return _workerThresholds;
}

export function setWorkerThresholds(thresholds: RemoteThresholds): void {
  _workerThresholds = thresholds;
}

// ---------------------------------------------------------------------------
// Threshold resolution helper
// ---------------------------------------------------------------------------

const DEFAULT_THRESHOLD = 0.7;

/**
 * Resolve the effective threshold for an assertion type.
 *
 * Priority: inline (per-matcher) > remote (dashboard) > default (0.7)
 */
export function resolveThreshold(
  assertionType: AssertionType,
  inlineThreshold?: number,
): { value: number; source: ThresholdSource } {
  if (inlineThreshold !== undefined) {
    return { value: inlineThreshold, source: "inline" };
  }

  const remote = _workerThresholds;
  if (remote && assertionType in remote) {
    return { value: remote[assertionType]!, source: "remote" };
  }

  return { value: DEFAULT_THRESHOLD, source: "default" };
}
