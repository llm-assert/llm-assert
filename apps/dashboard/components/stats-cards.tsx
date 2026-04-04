import { createClient } from "@/lib/supabase/server";
import { StatCard } from "@/components/stat-card";

export async function StatsCards({ projectId }: { projectId: string }) {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("get_project_stats", {
    p_project_id: projectId,
  });

  if (error) {
    console.error(
      "[projects/overview] system_error rpc=get_project_stats code=%s message=%s",
      error.code,
      error.message,
    );
    throw new Error("Failed to load project statistics");
  }

  const stats = data?.[0] ?? null;

  if (!stats || stats.total_evaluations === 0) {
    return (
      <div
        data-testid="stats-cards"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <StatCard
          title="Total Evaluations"
          value="0"
          description="No evaluations yet"
        />
        <StatCard title="Pass %" value="—" />
        <StatCard title="Fail %" value="—" />
        <StatCard title="Avg Score" value="—" />
      </div>
    );
  }

  const passPercent = (Number(stats.pass_rate) * 100).toFixed(1);
  const failPercent = (Number(stats.fail_rate) * 100).toFixed(1);
  const avgScore =
    stats.avg_score != null ? Number(stats.avg_score).toFixed(2) : "—";

  return (
    <div
      data-testid="stats-cards"
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
    >
      <StatCard
        title="Total Evaluations"
        value={stats.total_evaluations.toLocaleString()}
        description={`${stats.passed} passed · ${stats.failed} failed · ${stats.inconclusive} inconclusive`}
      />
      <StatCard title="Pass %" value={`${passPercent}%`} />
      <StatCard title="Fail %" value={`${failPercent}%`} />
      <StatCard title="Avg Score" value={avgScore} />
    </div>
  );
}
