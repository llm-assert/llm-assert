import { cache } from "react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DashboardHeader } from "@/components/dashboard-header";
import { RunsTable } from "@/components/runs-table";
import { RunsTableSkeleton } from "@/components/runs-table-skeleton";

const getProject = cache(async (slug: string) => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: project } = await supabase
    .from("projects")
    .select("id, name, slug")
    .eq("slug", slug)
    .eq("user_id", user.id)
    .single();

  return project;
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const project = await getProject(slug);

  return {
    title: project ? `Runs — ${project.name} — LLMAssert` : "Runs — LLMAssert",
  };
}

export default async function TestRunsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { slug } = await params;
  const { page: pageParam } = await searchParams;

  const page = Math.max(1, Math.floor(Number(pageParam) || 1));

  const project = await getProject(slug);

  if (!project) {
    notFound();
  }

  return (
    <>
      <DashboardHeader
        breadcrumbs={[
          { label: "Projects", href: "/" },
          { label: project.name, href: `/projects/${project.slug}` },
          { label: "Runs" },
        ]}
      />
      <div className="flex-1 p-4">
        <Suspense fallback={<RunsTableSkeleton />}>
          <RunsTable
            projectId={project.id}
            projectSlug={project.slug}
            page={page}
          />
        </Suspense>
      </div>
    </>
  );
}
