import Link from "next/link";
import { redirect } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  formatRelativeTime,
  formatDuration,
  formatPassRate,
  getPassRateColor,
} from "@/lib/format";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PaginationControls } from "@/components/pagination-controls";

const PER_PAGE = 25;

export async function RunsTable({
  projectId,
  projectSlug,
  page,
}: {
  projectId: string;
  projectSlug: string;
  page: number;
}) {
  const supabase = await createClient();

  const from = (page - 1) * PER_PAGE;
  const to = from + PER_PAGE - 1;

  const {
    data: runs,
    count,
    error,
  } = await supabase
    .from("test_runs")
    .select(
      "id, started_at, finished_at, branch, commit_sha, ci_provider, ci_run_url, total_evaluations, passed, failed, inconclusive",
      { count: "exact" },
    )
    .eq("project_id", projectId)
    .order("started_at", { ascending: false })
    .range(from, to);

  if (error) {
    console.error(
      "[projects/runs] system_error query=test_runs code=%s message=%s",
      error.code,
      error.message,
    );
    throw new Error("Failed to load test runs");
  }

  const totalCount = count ?? 0;
  const totalPages = Math.ceil(totalCount / PER_PAGE);

  // Out-of-range page handling
  if (page > totalPages && totalPages > 0) {
    redirect(`/projects/${projectSlug}/runs?page=${totalPages}`);
  }

  // Empty state
  if (!runs || runs.length === 0) {
    return (
      <div className="rounded-lg border p-12 text-center">
        <h3 className="text-lg font-semibold">No test runs yet</h3>
        <p className="mt-2 max-w-md mx-auto text-sm text-muted-foreground">
          Configure the{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
            @llmassert/playwright
          </code>{" "}
          reporter in your project to start sending test run data.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableCaption className="sr-only">
            Test runs for this project, page {page} of {totalPages}
          </TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Started</TableHead>
              <TableHead>Branch</TableHead>
              <TableHead>Commit</TableHead>
              <TableHead>CI</TableHead>
              <TableHead className="text-right">Evals</TableHead>
              <TableHead className="text-right">Pass %</TableHead>
              <TableHead className="text-right">Inc.</TableHead>
              <TableHead className="text-right">Duration</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {runs.map((run) => (
              <TableRow
                key={run.id}
                data-testid={`run-row-${run.id}`}
                className="group relative cursor-pointer"
              >
                <TableCell className="whitespace-nowrap text-sm">
                  <Link
                    href={`/projects/${projectSlug}/runs/${run.id}`}
                    className="after:absolute after:inset-0"
                  >
                    {formatRelativeTime(run.started_at)}
                  </Link>
                </TableCell>
                <TableCell className="max-w-[150px] truncate font-mono text-sm">
                  {run.branch ?? "—"}
                </TableCell>
                <TableCell className="font-mono text-sm text-muted-foreground">
                  {run.commit_sha ? (
                    run.ci_run_url ? (
                      <a
                        href={run.ci_run_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="relative z-10 inline-flex items-center gap-1 hover:text-foreground transition-colors"
                      >
                        {run.commit_sha.slice(0, 7)}
                        <ExternalLink className="size-3" />
                      </a>
                    ) : (
                      run.commit_sha.slice(0, 7)
                    )
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {run.ci_provider ?? "—"}
                </TableCell>
                <TableCell className="text-right tabular-nums text-sm">
                  {run.total_evaluations}
                </TableCell>
                <TableCell
                  className={`text-right tabular-nums text-sm ${getPassRateColor(run.passed, run.failed)}`}
                >
                  {formatPassRate(run.passed, run.failed)}
                </TableCell>
                <TableCell className="text-right tabular-nums text-sm">
                  {run.inconclusive > 0 ? (
                    <span
                      className="inline-flex items-center gap-1 text-amber-500"
                      title={`${run.inconclusive} inconclusive evaluation${run.inconclusive === 1 ? "" : "s"}`}
                    >
                      <span className="inline-block size-2 rounded-full bg-amber-500" />
                      {run.inconclusive}
                    </span>
                  ) : null}
                </TableCell>
                <TableCell className="whitespace-nowrap text-right text-sm">
                  {run.finished_at ? (
                    formatDuration(run.started_at, run.finished_at)
                  ) : (
                    <span className="text-muted-foreground">In progress</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <PaginationControls
        currentPage={page}
        totalPages={totalPages}
        totalCount={totalCount}
        perPage={PER_PAGE}
      />
    </div>
  );
}
