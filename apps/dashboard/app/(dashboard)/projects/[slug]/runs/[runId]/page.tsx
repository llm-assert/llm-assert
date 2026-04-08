import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAuthUser, requireAuth } from "@/lib/queries/get-auth-user";
import { getProject } from "@/lib/queries/get-project";
import { getRun, getRunAvgScore } from "@/lib/queries/get-run";
import { validateType, validateResult } from "@/lib/queries/get-evaluations";
import { DashboardHeader } from "@/components/dashboard-header";
import { RunSummary } from "@/components/run-summary";
import { EvaluationsFilterBar } from "@/components/evaluations-filter-bar";
import { EvaluationsTable } from "@/components/evaluations-table";
import { EvaluationsTableSkeleton } from "@/components/evaluations-table-skeleton";

type PageProps = {
  params: Promise<{ slug: string; runId: string }>;
  searchParams: Promise<{
    type?: string;
    result?: string;
    page?: string;
  }>;
};

async function resolveRunContext(slug: string, runId: string, userId: string) {
  const project = await getProject(slug, userId);
  if (!project) return null;

  const run = await getRun(runId, project.id);
  if (!run) return null;

  return { project, run };
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug, runId } = await params;
  const user = await getAuthUser();
  if (!user) return { title: "Run — LLMAssert" };

  const ctx = await resolveRunContext(slug, runId, user.id);

  if (!ctx) {
    return { title: "Run — LLMAssert" };
  }

  const label = ctx.run.commit_sha
    ? ctx.run.commit_sha.slice(0, 7)
    : runId.slice(0, 8);

  return {
    title: `Run ${label} — ${ctx.project.name} — LLMAssert`,
  };
}

export default async function RunDetailPage({
  params,
  searchParams,
}: PageProps) {
  const { slug, runId } = await params;
  const sp = await searchParams;

  const user = await requireAuth();

  const ctx = await resolveRunContext(slug, runId, user.id);
  if (!ctx) {
    notFound();
  }

  const { project, run } = ctx;

  const type = validateType(sp.type);
  const result = validateResult(sp.result);
  const page = Math.max(1, Math.floor(Number(sp.page) || 1));
  const avgScore = await getRunAvgScore(run.id, user.id);

  const runLabel = run.commit_sha
    ? run.commit_sha.slice(0, 7)
    : runId.slice(0, 8);

  return (
    <>
      <DashboardHeader
        breadcrumbs={[
          { label: "Projects", href: "/dashboard" },
          { label: project.name, href: `/projects/${project.slug}` },
          { label: "Runs", href: `/projects/${project.slug}/runs` },
          { label: `Run ${runLabel}` },
        ]}
      />
      <div className="flex-1 space-y-4 p-4">
        <RunSummary run={run} avgScore={avgScore} />

        <EvaluationsFilterBar currentType={type} currentResult={result} />

        <Suspense fallback={<EvaluationsTableSkeleton />}>
          <EvaluationsTable
            runId={run.id}
            userId={user.id}
            projectSlug={project.slug}
            filters={{ type, result }}
            page={page}
          />
        </Suspense>
      </div>
    </>
  );
}
