import { z } from "zod";

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export type PaginationParams = z.infer<typeof paginationSchema>;

export function parsePagination(
  searchParams: URLSearchParams,
): PaginationParams | { error: string } {
  const result = paginationSchema.safeParse({
    page: searchParams.get("page") ?? undefined,
    pageSize: searchParams.get("pageSize") ?? undefined,
  });

  if (!result.success) {
    return {
      error: result.error.issues.map((i) => i.message).join(", "),
    };
  }

  return result.data;
}

const daysSchema = z.coerce
  .number()
  .int()
  .min(1)
  .default(30)
  .transform((v) => Math.min(v, 365));

export function parseDays(
  searchParams: URLSearchParams,
): number | { error: string } {
  const result = daysSchema.safeParse(searchParams.get("days") ?? undefined);

  if (!result.success) {
    return {
      error: result.error.issues.map((i) => i.message).join(", "),
    };
  }

  return result.data;
}

const assertionTypes = [
  "groundedness",
  "pii",
  "sentiment",
  "schema",
  "fuzzy",
] as const;

const resultTypes = ["pass", "fail", "inconclusive"] as const;

export type EvaluationFilters = {
  type?: string;
  result?: string;
};

export function parseEvaluationFilters(
  searchParams: URLSearchParams,
): EvaluationFilters | { error: string } {
  const type = searchParams.get("type");
  const result = searchParams.get("result");

  if (
    type &&
    !assertionTypes.includes(type as (typeof assertionTypes)[number])
  ) {
    return {
      error: `Invalid type filter. Must be one of: ${assertionTypes.join(", ")}`,
    };
  }

  if (result && !resultTypes.includes(result as (typeof resultTypes)[number])) {
    return {
      error: `Invalid result filter. Must be one of: ${resultTypes.join(", ")}`,
    };
  }

  return {
    type: type ?? undefined,
    result: result ?? undefined,
  };
}
