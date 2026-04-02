import { Suspense } from "react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DashboardHeader } from "@/components/dashboard-header";
import { StatsCards } from "@/components/stats-cards";
import { RecentRunsTable } from "@/components/recent-runs-table";
import { StatCardSkeleton } from "@/components/stat-card-skeleton";
import { RecentRunsTableSkeleton } from "@/components/recent-runs-table-skeleton";

export default async function ProjectOverviewPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    notFound();
  }

  const { data: project } = await supabase
    .from("projects")
    .select("id, name, slug, description")
    .eq("slug", slug)
    .eq("user_id", user.id)
    .single();

  if (!project) {
    notFound();
  }

  return (
    <>
      <DashboardHeader
        breadcrumbs={[
          { label: "Projects", href: "/" },
          { label: project.name },
        ]}
      />
      <div className="flex-1 space-y-6 p-4">
        <div>
          <h1 className="text-2xl font-semibold">{project.name}</h1>
          {project.description && (
            <p className="mt-1 text-sm text-muted-foreground">
              {project.description}
            </p>
          )}
        </div>

        <Suspense
          fallback={
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
            </div>
          }
        >
          <StatsCards projectId={project.id} />
        </Suspense>

        <Suspense fallback={<RecentRunsTableSkeleton />}>
          <RecentRunsTable projectId={project.id} projectSlug={project.slug} />
        </Suspense>
      </div>
    </>
  );
}
