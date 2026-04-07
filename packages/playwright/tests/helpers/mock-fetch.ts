export interface FetchCall {
  url: string | URL | Request;
  init?: RequestInit;
}

export interface MockFetchResponse {
  status: number;
  body?: string;
}

let originalFetch: typeof globalThis.fetch | null = null;
let calls: FetchCall[] = [];

export function mockFetch(responses: MockFetchResponse[]): void {
  calls = [];
  originalFetch = globalThis.fetch;
  let callIndex = 0;

  globalThis.fetch = async (
    url: string | URL | Request,
    init?: RequestInit,
  ): Promise<Response> => {
    calls.push({ url, init });
    const response = responses[callIndex] ?? responses[responses.length - 1];
    callIndex++;
    return new Response(response.body ?? "", { status: response.status });
  };
}

export function build429Response(overrides?: {
  plan?: string;
  next_reset_date?: string | null;
  evaluations_used?: number;
  evaluation_limit?: number;
}): MockFetchResponse {
  return {
    status: 429,
    body: JSON.stringify({
      error: {
        code: "QUOTA_EXCEEDED",
        message: "Evaluation limit reached.",
        details: {
          evaluations_used: overrides?.evaluations_used ?? 100,
          evaluation_limit: overrides?.evaluation_limit ?? 100,
          plan: overrides?.plan ?? "free",
          next_reset_date: overrides?.next_reset_date ?? "2026-05-01T00:00:00Z",
          upgrade_url: "https://llmassert.com/settings/billing",
        },
      },
    }),
  };
}

export function build413Response(overrides?: {
  max_bytes?: number;
  actual_bytes?: number;
}): MockFetchResponse {
  return {
    status: 413,
    body: JSON.stringify({
      error: {
        code: "PAYLOAD_TOO_LARGE",
        message: "Request body exceeds 1 MB size limit",
        details: {
          max_bytes: overrides?.max_bytes ?? 1_048_576,
          actual_bytes: overrides?.actual_bytes ?? 1_500_000,
        },
      },
    }),
  };
}

export function getFetchCalls(): FetchCall[] {
  return calls;
}

export function restoreFetch(): void {
  if (originalFetch) {
    globalThis.fetch = originalFetch;
    originalFetch = null;
  }
  calls = [];
}
