import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProject } from "@/lib/queries/get-project";
import { getRun } from "@/lib/queries/get-run";
import { getEvaluation } from "@/lib/queries/get-evaluation";
import { DashboardHeader } from "@/components/dashboard-header";
import { EvaluationMetadataPanel } from "@/components/evaluation-metadata-panel";
import { EvaluationContentPanel } from "@/components/evaluation-content-panel";

type PageProps = {
  params: Promise<{ slug: string; runId: string; evalId: string }>;
};

async function resolveEvaluationContext(
  slug: string,
  runId: string,
  evalId: string,
) {
  const project = await getProject(slug);
  if (!project) return null;

  const run = await getRun(runId, project.id);
  if (!run) return null;

  const evaluation = await getEvaluation(evalId, run.id);
  if (!evaluation) return null;

  return { project, run, evaluation };
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug, runId, evalId } = await params;
  const ctx = await resolveEvaluationContext(slug, runId, evalId);

  if (!ctx) {
    return { title: "Evaluation — LLMAssert" };
  }

  return {
    title: `${ctx.evaluation.assertion_type} — ${ctx.evaluation.test_name} — ${ctx.project.name} — LLMAssert`,
  };
}

export default async function EvaluationDetailPage({ params }: PageProps) {
  const { slug, runId, evalId } = await params;

  const ctx = await resolveEvaluationContext(slug, runId, evalId);
  if (!ctx) {
    notFound();
  }

  const { project, run, evaluation } = ctx;

  const runLabel = run.commit_sha
    ? run.commit_sha.slice(0, 7)
    : runId.slice(0, 8);

  const pagePath = `/projects/${project.slug}/runs/${runId}/evaluations/${evaluation.id}`;

  return (
    <>
      <DashboardHeader
        breadcrumbs={[
          { label: "Projects", href: "/" },
          { label: project.name, href: `/projects/${project.slug}` },
          { label: "Runs", href: `/projects/${project.slug}/runs` },
          {
            label: `Run ${runLabel}`,
            href: `/projects/${project.slug}/runs/${runId}`,
          },
          { label: evaluation.assertion_type },
        ]}
      />
      <div className="flex-1 p-4">
        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
          <section
            aria-labelledby="metadata-heading"
            className="lg:sticky lg:top-4 lg:self-start"
          >
            <h2 id="metadata-heading" className="sr-only">
              Evaluation Metadata
            </h2>
            <EvaluationMetadataPanel
              evaluation={evaluation}
              pagePath={pagePath}
            />
          </section>

          <section aria-labelledby="content-heading">
            <h2 id="content-heading" className="sr-only">
              Evaluation Details
            </h2>
            <EvaluationContentPanel evaluation={evaluation} />
          </section>
        </div>
      </div>
    </>
  );
}
