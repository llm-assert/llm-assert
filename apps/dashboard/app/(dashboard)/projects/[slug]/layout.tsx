import { ProjectTabs } from "@/components/project-tabs";

export default async function ProjectLayout({
  params,
  children,
}: {
  params: Promise<{ slug: string }>;
  children: React.ReactNode;
}) {
  const { slug } = await params;

  return (
    <div className="flex flex-1 flex-col">
      <div className="px-4 pt-2">
        <ProjectTabs slug={slug} />
      </div>
      {children}
    </div>
  );
}
