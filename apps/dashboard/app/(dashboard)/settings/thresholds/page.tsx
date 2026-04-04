import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ProjectSelector } from "@/components/project-selector";
import { ThresholdsForm } from "@/components/thresholds-form";
import { Skeleton } from "@/components/ui/skeleton";
import { Info } from "lucide-react";

const ASSERTION_TYPES = [
  "groundedness",
  "pii",
  "sentiment",
  "schema",
  "fuzzy",
] as const;

const DEFAULT_THRESHOLD = 0.7;

export default async function ThresholdsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const projectSlug =
    typeof params.project === "string" ? params.project : undefined;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  // Fetch projects and thresholds in parallel
  const [{ data: projects }, { data: thresholdRows }] = await Promise.all([
    supabase.from("projects").select("id, name, slug").order("name"),
    supabase
      .from("thresholds")
      .select("project_id, assertion_type, pass_threshold")
      .eq("user_id", user.id),
  ]);

  if (!projects || projects.length === 0) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <h1 className="text-2xl font-semibold">Thresholds</h1>
        <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
          <p className="text-muted-foreground">
            Create a project first to configure thresholds.
          </p>
        </div>
      </div>
    );
  }

  // Resolve selected project
  const selectedProject =
    projects.find((p) => p.slug === projectSlug) ?? projects[0];

  // Merge sparse thresholds → dense 5-entry array
  const projectThresholds = ASSERTION_TYPES.map((type) => {
    const row = thresholdRows?.find(
      (r) => r.project_id === selectedProject.id && r.assertion_type === type,
    );
    return {
      assertionType: type,
      value: row ? Number(row.pass_threshold) : DEFAULT_THRESHOLD,
    };
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Thresholds</h1>
        <Suspense fallback={<Skeleton className="h-9 w-[220px]" />}>
          <ProjectSelector
            projects={projects}
            selectedSlug={selectedProject.slug}
          />
        </Suspense>
      </div>

      <div className="flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800 dark:border-blue-900 dark:bg-blue-950/50 dark:text-blue-200">
        <Info className="mt-0.5 size-4 shrink-0" />
        <p>
          These thresholds affect how evaluation results are displayed in the
          dashboard. They do not change how tests pass or fail in CI — plugin
          thresholds are configured in your <code>playwright.config.ts</code>.
        </p>
      </div>

      <ThresholdsForm
        key={selectedProject.id}
        projectId={selectedProject.id}
        thresholds={projectThresholds}
      />
    </div>
  );
}
