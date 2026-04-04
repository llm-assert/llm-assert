import "server-only";

export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
} as const;

export type PaginationMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

function json(
  body: unknown,
  status: number,
  headers?: HeadersInit,
  cors?: boolean,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...(cors ? CORS_HEADERS : {}),
      ...headers,
    },
  });
}

export function success(
  data: unknown,
  options?: { headers?: Record<string, string>; cors?: boolean },
): Response {
  return json({ data }, 200, options?.headers, options?.cors);
}

export function paginated(
  data: unknown[],
  pagination: PaginationMeta,
  options?: { headers?: Record<string, string>; cors?: boolean },
): Response {
  return json({ data, pagination }, 200, options?.headers, options?.cors);
}

export function error(
  code: string,
  message: string,
  status: number,
  details?: Record<string, unknown>,
): Response {
  const body = details
    ? { error: { code, message, details } }
    : { error: { code, message } };
  // Error responses always include CORS to ensure cross-origin clients receive error details
  return json(body, status, undefined, true);
}

export function OPTIONS(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
