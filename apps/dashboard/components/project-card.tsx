import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { CopySlugButton } from "@/components/copy-slug-button";

export type ProjectData = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
};

export type LatestRunData = {
  started_at: string;
  branch: string | null;
  total_evaluations: number;
  passed: number;
  failed: number;
  inconclusive: number;
};

function formatRelativeTime(dateString: string): string {
  const diff = Date.now() - new Date(dateString).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateString).toLocaleDateString();
}

function HealthBar({ run }: { run: LatestRunData }) {
  const total = run.total_evaluations || 1;
  const passPercent = Math.round((run.passed / total) * 100);
  const failPercent = Math.round((run.failed / total) * 100);
  const inconclusivePercent = 100 - passPercent - failPercent;

  return (
    <div className="space-y-1.5">
      <div
        className="flex h-2 overflow-hidden rounded-full bg-muted"
        role="img"
        aria-label={`${passPercent}% passed. ${run.passed} passed, ${run.failed} failed, ${run.inconclusive} inconclusive`}
      >
        {run.passed > 0 && (
          <div
            className="bg-emerald-500"
            style={{ width: `${passPercent}%` }}
          />
        )}
        {run.failed > 0 && (
          <div className="bg-red-500" style={{ width: `${failPercent}%` }} />
        )}
        {run.inconclusive > 0 && (
          <div
            className="bg-amber-500"
            style={{ width: `${inconclusivePercent}%` }}
          />
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        {passPercent}% passed · {run.passed} passed · {run.failed} failed ·{" "}
        {run.inconclusive} inconclusive
      </p>
    </div>
  );
}

export function ProjectCard({
  project,
  latestRun,
}: {
  project: ProjectData;
  latestRun: LatestRunData | null;
}) {
  return (
    <Link
      href={`/projects/${project.slug}`}
      className="block rounded-lg transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Card className="h-full">
        <CardHeader className="pb-2">
          <h3 className="text-base font-semibold leading-tight truncate">
            {project.name}
          </h3>
          <div className="flex items-center gap-1">
            <code className="text-xs text-muted-foreground font-mono truncate">
              {project.slug}
            </code>
            <CopySlugButton slug={project.slug} />
          </div>
          {project.description && (
            <p className="text-xs text-muted-foreground line-clamp-2">
              {project.description}
            </p>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {latestRun ? (
            <>
              <HealthBar run={latestRun} />
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{formatRelativeTime(latestRun.started_at)}</span>
                {latestRun.branch && (
                  <>
                    <span>·</span>
                    <span className="truncate font-mono">
                      {latestRun.branch}
                    </span>
                  </>
                )}
              </div>
            </>
          ) : (
            <p className="text-xs text-muted-foreground italic">No runs yet</p>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
