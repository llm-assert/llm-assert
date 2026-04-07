import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DashboardHeader } from "@/components/dashboard-header";
import { CreateProjectDialog } from "@/components/create-project-dialog";
import { OnboardingChecklist } from "@/components/onboarding-checklist";
import {
  ProjectCard,
  type ProjectData,
  type LatestRunData,
} from "@/components/project-card";
import { getOnboardingState } from "@/lib/queries/get-onboarding-state";

type RunRow = LatestRunData & { project_id: string };

export default async function ProjectsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: projects, error: projectsError } = await supabase
    .from("projects")
    .select("id, name, slug, description")
    // RLS perf hint — not a security boundary (see CLAUDE.md)
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  if (projectsError) {
    throw new Error(`Failed to load projects: ${projectsError.message}`);
  }

  const projectIds = (projects ?? []).map((p) => p.id);

  // Only query runs if there are projects
  let runs: RunRow[] = [];
  if (projectIds.length > 0) {
    const { data: runsData, error: runsError } = await supabase
      .from("test_runs")
      .select(
        "project_id, started_at, branch, total_evaluations, passed, failed, inconclusive",
      )
      .in("project_id", projectIds)
      // RLS perf hint — not a security boundary (see CLAUDE.md)
      .eq("user_id", user.id)
      .order("started_at", { ascending: false });

    if (runsError) {
      throw new Error(`Failed to load test runs: ${runsError.message}`);
    }

    runs = (runsData ?? []) as RunRow[];
  }

  const onboarding = getOnboardingState(
    projects ?? [],
    runs,
    user?.user_metadata,
  );

  // Full onboarding: no projects yet
  if (onboarding.step === "create-project") {
    return (
      <>
        <DashboardHeader />
        <div className="flex-1 p-4">
          <OnboardingChecklist step="create-project" variant="full" />
        </div>
      </>
    );
  }

  // Deduplicate to latest run per project
  const latestRunByProject = new Map<string, LatestRunData>();
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

  return (
    <>
      <DashboardHeader />
      <div className="flex-1 p-4">
        {onboarding.showBanner && (
          <OnboardingChecklist
            step="install-reporter"
            variant="banner"
            projectSlug={projects?.[0]?.slug}
          />
        )}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Projects</h1>
          <CreateProjectDialog />
        </div>
        <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(projects ?? []).map((project: ProjectData) => (
            <li key={project.id}>
              <ProjectCard
                project={project}
                latestRun={latestRunByProject.get(project.id) ?? null}
              />
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
