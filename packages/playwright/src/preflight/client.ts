import type { PreflightResult } from "../types.js";
import { log } from "../logger.js";

const DEFAULT_TIMEOUT_MS = 5_000;

export interface PreflightClientConfig {
  dashboardUrl: string;
  apiKey: string;
  projectSlug: string;
  timeout?: number;
}

export class PreflightClient {
  private config: PreflightClientConfig;

  constructor(config: PreflightClientConfig) {
    this.config = config;
  }

  async fetch(): Promise<PreflightResult> {
    const url = `${this.config.dashboardUrl}/api/ingest/preflight?project_slug=${encodeURIComponent(this.config.projectSlug)}`;
    const timeout = this.config.timeout ?? DEFAULT_TIMEOUT_MS;
    const start = performance.now();

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(timeout),
      });

      const latencyMs = Math.round(performance.now() - start);

      // 404 could be: (a) route not found (dashboard too old), or
      // (b) project not found (from resolveProject in the endpoint).
      // Distinguish by checking for a JSON error body.
      if (response.status === 404) {
        try {
          const body = await response.json();
          if (body?.error?.code) {
            // Endpoint returned a structured error → project not found
            return {
              error: body.error.message ?? "Project not found",
              statusCode: 404,
              latencyMs,
            };
          }
        } catch {
          // No JSON body → route doesn't exist (dashboard too old)
        }
        log("debug", "reporter.preflight_ok", {
          latency_ms: latencyMs,
          status: "dashboard_too_old",
        });
        return {
          status: "ok",
          project: { slug: this.config.projectSlug, name: "" },
          quota: { evaluations_used: 0, evaluation_limit: 0, plan: "unknown" },
          latencyMs,
        };
      }

      if (!response.ok) {
        let errorMessage: string;
        try {
          const body = await response.json();
          errorMessage = body?.error?.message ?? `HTTP ${response.status}`;
        } catch {
          errorMessage = `HTTP ${response.status} ${response.statusText}`;
        }

        return { error: errorMessage, statusCode: response.status, latencyMs };
      }

      // Shape validated by the guard below — cast is safe because
      // missing/unexpected fields fall through to the error return.
      const body = (await response.json()) as {
        data?: {
          status: "ok" | "quota_warning" | "quota_exceeded";
          project: { slug: string; name: string };
          quota: {
            evaluations_used: number;
            evaluation_limit: number;
            plan: string;
          };
        };
      };

      if (!body.data || !body.data.status) {
        return {
          error: "Preflight returned invalid response shape",
          statusCode: response.status,
          latencyMs,
        };
      }

      return { ...body.data, latencyMs };
    } catch (error) {
      const latencyMs = Math.round(performance.now() - start);
      const message = error instanceof Error ? error.message : String(error);
      const dashboardUrl = this.config.dashboardUrl;

      return {
        error: `Preflight request failed (${dashboardUrl}): ${message}`,
        statusCode: 0,
        latencyMs,
      };
    }
  }
}
