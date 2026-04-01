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
