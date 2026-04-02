import { createClient } from "@/lib/supabase/server";

const VALID_TYPES = [
  "groundedness",
  "pii",
  "sentiment",
  "schema",
  "fuzzy",
] as const;
const VALID_RESULTS = ["pass", "fail", "inconclusive"] as const;

export type AssertionTypeFilter = (typeof VALID_TYPES)[number];
export type ResultFilter = (typeof VALID_RESULTS)[number];

const PER_PAGE = 25;

export function validateType(
  value: string | undefined,
): AssertionTypeFilter | undefined {
  if (!value) return undefined;
  return VALID_TYPES.includes(value as AssertionTypeFilter)
    ? (value as AssertionTypeFilter)
    : undefined;
}

export function validateResult(
  value: string | undefined,
): ResultFilter | undefined {
  if (!value) return undefined;
  return VALID_RESULTS.includes(value as ResultFilter)
    ? (value as ResultFilter)
    : undefined;
}

export async function getEvaluations(
  runId: string,
  filters: {
    type?: AssertionTypeFilter;
    result?: ResultFilter;
  },
  page: number,
) {
  const supabase = await createClient();
  const from = (page - 1) * PER_PAGE;
  const to = from + PER_PAGE - 1;

  const start = performance.now();

  let query = supabase
    .from("evaluations")
    .select(
      "id, test_run_id, assertion_type, test_name, test_file, input_text, context_text, expected_value, result, score, reasoning, judge_model, judge_latency_ms, judge_cost_usd, fallback_used, threshold, created_at",
      { count: "exact" },
    )
    .eq("test_run_id", runId)
    .order("created_at", { ascending: false });

  if (filters.type) {
    query = query.eq("assertion_type", filters.type);
  }
  if (filters.result) {
    query = query.eq("result", filters.result);
  }

  const { data, count, error } = await query.range(from, to);

  const ms = Math.round(performance.now() - start);

  if (error) {
    console.error(
      "[runs/detail] system_error query=evaluations code=%s message=%s",
      error.code,
      error.message,
    );
    throw new Error("Failed to load evaluations");
  }

  const totalCount = count ?? 0;

  if (totalCount > 250) {
    console.warn(
      "[runs/detail] large_result_set evaluations count=%d ms=%d run_id=%s",
      totalCount,
      ms,
      runId,
    );
  }

  return {
    evaluations: data ?? [],
    totalCount,
    totalPages: Math.ceil(totalCount / PER_PAGE),
    perPage: PER_PAGE,
  };
}
