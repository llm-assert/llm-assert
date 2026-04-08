import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/queries/get-auth-user";
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

  const user = await requireAuth();
  const supabase = await createClient();

  // Fetch projects and thresholds in parallel
  const [{ data: projects }, { data: thresholdRows }] = await Promise.all([
    supabase
      .from("projects")
      .select("id, name, slug")
      // RLS perf hint — not a security boundary (see CLAUDE.md)
      .eq("user_id", user.id)
      .order("name"),
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

      <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
        <Info className="mt-0.5 size-4 shrink-0" />
        <div>
          <p>
            These thresholds affect CI test pass/fail when your plugin is
            configured with <code>dashboardUrl</code> and <code>apiKey</code> in
            your reporter config:
          </p>
          <pre className="mt-2 rounded bg-amber-100 px-2 py-1 text-xs dark:bg-amber-900/50">
            {`reporter: [['@llmassert/playwright/reporter', {
  apiKey: process.env.LLMASSERT_API_KEY,
  projectSlug: 'your-project',
  dashboardUrl: 'https://llmassert.com',
}]]`}
          </pre>
          <p className="mt-1.5">
            Inline <code>options.threshold</code> overrides in test code take
            precedence over these values.
          </p>
        </div>
      </div>

      <ThresholdsForm
        key={selectedProject.id}
        projectId={selectedProject.id}
        thresholds={projectThresholds}
      />
    </div>
  );
}
