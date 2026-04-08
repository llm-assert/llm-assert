import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getAuthUser, requireAuth } from "@/lib/queries/get-auth-user";
import { getProject } from "@/lib/queries/get-project";
import {
  getProjectTrends,
  validateRange,
  rangeToDays,
} from "@/lib/queries/get-project-trends";
import { DashboardHeader } from "@/components/dashboard-header";
import { RangeSelector } from "@/components/range-selector";
import { ChartSkeleton } from "@/components/chart-skeleton";
import { TrendsCharts } from "@/components/trends-charts";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const user = await getAuthUser();
  if (!user) return { title: "Trends — LLMAssert" };

  const project = await getProject(slug, user.id);

  return {
    title: project
      ? `Trends — ${project.name} — LLMAssert`
      : "Trends — LLMAssert",
  };
}

export default async function TrendsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ range?: string }>;
}) {
  const { slug } = await params;
  const { range: rangeParam } = await searchParams;

  const user = await requireAuth();

  const range = validateRange(rangeParam);
  const days = rangeToDays(range);

  const project = await getProject(slug, user.id);

  if (!project) {
    notFound();
  }

  // Start fetch without awaiting — streams to client via use() API
  const dataPromise = getProjectTrends(project.id, days);

  return (
    <>
      <DashboardHeader
        breadcrumbs={[
          { label: "Projects", href: "/dashboard" },
          { label: project.name, href: `/projects/${project.slug}` },
          { label: "Trends" },
        ]}
      />
      <div className="flex-1 space-y-4 p-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Trends</h1>
          <RangeSelector range={range} />
        </div>

        <Suspense
          fallback={
            <div className="space-y-4">
              <ChartSkeleton />
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <ChartSkeleton />
                <ChartSkeleton />
              </div>
            </div>
          }
        >
          <TrendsCharts dataPromise={dataPromise} />
        </Suspense>
      </div>
    </>
  );
}
