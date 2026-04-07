import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export const getRun = cache(async (runId: string, projectId: string) => {
  const supabase = await createClient();

  const { data: run } = await supabase
    .from("test_runs")
    .select(
      "id, project_id, started_at, finished_at, branch, commit_sha, ci_provider, ci_run_url, total_evaluations, passed, failed, inconclusive, metadata",
    )
    .eq("id", runId)
    .eq("project_id", projectId)
    .single();

  return run;
});

export const getRunAvgScore = cache(
  async (runId: string, userId: string): Promise<number | null> => {
    const supabase = await createClient();

    const { data } = await supabase
      .from("evaluations")
      .select("avg_score:score.avg()")
      .eq("test_run_id", runId)
      // RLS perf hint — not a security boundary (see CLAUDE.md)
      .eq("user_id", userId);

    if (!data || data.length === 0) return null;

    const avg = (data[0] as { avg_score: number | null }).avg_score;
    return avg;
  },
);
