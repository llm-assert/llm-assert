import { ExternalLink, GitBranch, Clock, Timer, Hash } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  formatRelativeTime,
  formatDuration,
  formatPassRate,
  formatScore,
  getPassRateColor,
} from "@/lib/format";

type Run = {
  started_at: string;
  finished_at: string | null;
  branch: string | null;
  commit_sha: string | null;
  ci_provider: string | null;
  ci_run_url: string | null;
  total_evaluations: number;
  passed: number;
  failed: number;
  inconclusive: number;
};

export function RunSummary({
  run,
  avgScore,
}: {
  run: Run;
  avgScore: number | null;
}) {
  return (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-x-6 gap-y-3 p-4">
        <div className="flex items-center gap-1.5 text-sm">
          <GitBranch className="size-3.5 text-muted-foreground" />
          <span className="max-w-[200px] truncate font-mono">
            {run.branch ?? "—"}
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Hash className="size-3.5" />
          {run.commit_sha ? (
            run.ci_run_url ? (
              <a
                href={run.ci_run_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-mono hover:text-foreground transition-colors"
              >
                {run.commit_sha.slice(0, 7)}
                <ExternalLink className="size-3" />
              </a>
            ) : (
              <span className="font-mono">{run.commit_sha.slice(0, 7)}</span>
            )
          ) : (
            "—"
          )}
        </div>

        {run.ci_provider && (
          <span className="text-sm text-muted-foreground">
            {run.ci_provider}
          </span>
        )}

        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Clock className="size-3.5" />
          {formatRelativeTime(run.started_at)}
        </div>

        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Timer className="size-3.5" />
          {run.finished_at ? (
            formatDuration(run.started_at, run.finished_at)
          ) : (
            <span>In progress</span>
          )}
        </div>

        <div className="ml-auto flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 text-sm text-emerald-500">
            <span className="inline-block size-2 rounded-full bg-emerald-500" />
            {run.passed}
            <span className="sr-only">passed</span>
          </span>
          <span className="inline-flex items-center gap-1.5 text-sm text-red-500">
            <span className="inline-block size-2 rounded-full bg-red-500" />
            {run.failed}
            <span className="sr-only">failed</span>
          </span>
          {run.inconclusive > 0 && (
            <span className="inline-flex items-center gap-1.5 text-sm text-amber-500">
              <span className="inline-block size-2 rounded-full bg-amber-500" />
              {run.inconclusive}
              <span className="sr-only">inconclusive</span>
            </span>
          )}

          <span className="border-l pl-3 text-sm">
            <span
              className={`tabular-nums font-medium ${getPassRateColor(run.passed, run.failed)}`}
            >
              {formatPassRate(run.passed, run.failed)}
            </span>
          </span>

          <span className="border-l pl-3 text-sm text-muted-foreground">
            Avg:{" "}
            <span className="tabular-nums font-medium text-foreground">
              {formatScore(avgScore)}
            </span>
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
