import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProject } from "@/lib/queries/get-project";
import { getProjectTrends } from "@/lib/queries/get-project-trends";
import { getAssertionBreakdown } from "@/lib/queries/get-assertion-breakdown";
import { DashboardHeader } from "@/components/dashboard-header";
import { StatsCards } from "@/components/stats-cards";
import {
  OverviewSparklineCard,
  OverviewBreakdownCard,
} from "@/components/overview-charts";
import { ChartErrorBoundary } from "@/components/chart-error-boundary";
import { RecentRunsTable } from "@/components/recent-runs-table";
import { StatCardSkeleton } from "@/components/stat-card-skeleton";
import { ChartSkeleton } from "@/components/chart-skeleton";
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
  if (!user) redirect("/sign-in");

  const project = await getProject(slug);

  if (!project) {
    notFound();
  }

  // Start chart data fetches without awaiting — streams to client via use() API
  const trendsPromise = getProjectTrends(project.id, 7);
  const breakdownPromise = getAssertionBreakdown(project.id);

  return (
    <>
      <DashboardHeader
        breadcrumbs={[
          { label: "Projects", href: "/dashboard" },
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

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ChartErrorBoundary title="Evaluation Volume — Last 7 Days">
            <Suspense fallback={<ChartSkeleton />}>
              <OverviewSparklineCard dataPromise={trendsPromise} />
            </Suspense>
          </ChartErrorBoundary>

          <ChartErrorBoundary title="Assertion Type Breakdown">
            <Suspense fallback={<ChartSkeleton />}>
              <OverviewBreakdownCard dataPromise={breakdownPromise} />
            </Suspense>
          </ChartErrorBoundary>
        </div>

        <Suspense fallback={<RecentRunsTableSkeleton />}>
          <RecentRunsTable
            projectId={project.id}
            projectSlug={project.slug}
            userId={user.id}
          />
        </Suspense>
      </div>
    </>
  );
}
