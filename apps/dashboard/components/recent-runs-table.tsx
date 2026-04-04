import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatRelativeTime } from "@/lib/format";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export async function RecentRunsTable({
  projectId,
  projectSlug,
}: {
  projectId: string;
  projectSlug: string;
}) {
  const supabase = await createClient();

  const { data: runs, error } = await supabase
    .from("test_runs")
    .select(
      "id, started_at, branch, commit_sha, total_evaluations, passed, failed, inconclusive",
    )
    .eq("project_id", projectId)
    .order("started_at", { ascending: false })
    .limit(10);

  if (error) {
    console.error(
      "[projects/overview] system_error query=test_runs code=%s message=%s",
      error.code,
      error.message,
    );
    throw new Error("Failed to load recent runs");
  }

  if (!runs || runs.length === 0) {
    return (
      <div className="rounded-lg border p-8 text-center">
        <p className="text-sm text-muted-foreground">
          No test runs yet. Configure the{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
            @llmassert/playwright
          </code>{" "}
          reporter to start sending data.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">Recent Runs</h2>
      <div className="overflow-x-auto rounded-lg border">
        <Table data-testid="recent-runs-table">
          <TableHeader>
            <TableRow>
              <TableHead>Started</TableHead>
              <TableHead>Branch</TableHead>
              <TableHead>Commit</TableHead>
              <TableHead className="text-right">Passed</TableHead>
              <TableHead className="text-right">Failed</TableHead>
              <TableHead className="text-right">Inc.</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {runs.map((run) => (
              <TableRow key={run.id} data-testid={`run-row-${run.id}`}>
                <TableCell className="whitespace-nowrap text-sm">
                  {formatRelativeTime(run.started_at)}
                </TableCell>
                <TableCell className="max-w-[150px] truncate font-mono text-sm">
                  {run.branch ?? "—"}
                </TableCell>
                <TableCell className="font-mono text-sm text-muted-foreground">
                  {run.commit_sha ? run.commit_sha.slice(0, 7) : "—"}
                </TableCell>
                <TableCell className="text-right tabular-nums text-sm text-emerald-500">
                  {run.passed}
                </TableCell>
                <TableCell className="text-right tabular-nums text-sm text-red-500">
                  {run.failed}
                </TableCell>
                <TableCell className="text-right tabular-nums text-sm text-amber-500">
                  {run.inconclusive}
                </TableCell>
                <TableCell className="text-right tabular-nums text-sm">
                  {run.total_evaluations}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="flex justify-end">
        <Link
          href={`/projects/${projectSlug}/runs`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          View all runs
          <ArrowRight className="size-3.5" />
        </Link>
      </div>
    </div>
  );
}
