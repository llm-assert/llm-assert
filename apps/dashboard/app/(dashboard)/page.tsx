import { createClient } from "@/lib/supabase/server";
import { CreateProjectDialog } from "@/components/create-project-dialog";
import { EmptyState } from "@/components/empty-state";
import {
  ProjectCard,
  type ProjectData,
  type LatestRunData,
} from "@/components/project-card";

export default async function ProjectsPage() {
  const supabase = await createClient();

  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, slug, description")
    .order("updated_at", { ascending: false });

  if (!projects || projects.length === 0) {
    return <EmptyState />;
  }

  const projectIds = projects.map((p) => p.id);

  const { data: runs } = await supabase
    .from("test_runs")
    .select(
      "project_id, started_at, branch, total_evaluations, passed, failed, inconclusive",
    )
    .in("project_id", projectIds)
    .order("started_at", { ascending: false });

  // Deduplicate to latest run per project
  const latestRunByProject = new Map<string, LatestRunData>();
  if (runs) {
    for (const run of runs) {
      if (!latestRunByProject.has(run.project_id)) {
        latestRunByProject.set(run.project_id, {
          started_at: run.started_at,
          branch: run.branch,
          total_evaluations: run.total_evaluations,
          passed: run.passed,
          failed: run.failed,
          inconclusive: run.inconclusive,
        });
      }
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Projects</h1>
        <CreateProjectDialog />
      </div>
      <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((project: ProjectData) => (
          <li key={project.id}>
            <ProjectCard
              project={project}
              latestRun={latestRunByProject.get(project.id) ?? null}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
