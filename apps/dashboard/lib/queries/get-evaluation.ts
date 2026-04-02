import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export const getEvaluation = cache(async (evalId: string, runId: string) => {
  const supabase = await createClient();

  const start = performance.now();

  const { data: evaluation, error } = await supabase
    .from("evaluations")
    .select(
      "id, test_run_id, assertion_type, test_name, test_file, input_text, context_text, expected_value, result, score, reasoning, judge_model, judge_latency_ms, judge_cost_usd, fallback_used, threshold, created_at",
    )
    .eq("id", evalId)
    .eq("test_run_id", runId)
    .single();

  const ms = Math.round(performance.now() - start);

  if (error) {
    if (error.code === "PGRST116") {
      // No rows returned — not found
      return null;
    }
    console.error(
      "[evaluations/detail] system_error query=evaluation code=%s message=%s ms=%d",
      error.code,
      error.message,
      ms,
    );
    throw new Error("Failed to load evaluation");
  }

  return evaluation;
});
