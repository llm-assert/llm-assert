import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Table,
  TableBody,
  TableCaption,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PaginationControls } from "@/components/pagination-controls";
import { ExpandableEvaluationRow } from "@/components/expandable-evaluation-row";
import { getEvaluations } from "@/lib/queries/get-evaluations";
import type {
  AssertionTypeFilter,
  ResultFilter,
} from "@/lib/queries/get-evaluations";

export async function EvaluationsTable({
  runId,
  projectSlug,
  filters,
  page,
}: {
  runId: string;
  projectSlug: string;
  filters: { type?: AssertionTypeFilter; result?: ResultFilter };
  page: number;
}) {
  const { evaluations, totalCount, totalPages, perPage } = await getEvaluations(
    runId,
    filters,
    page,
  );

  // Out-of-range page handling
  if (page > totalPages && totalPages > 0) {
    const params = new URLSearchParams();
    if (filters.type) params.set("type", filters.type);
    if (filters.result) params.set("result", filters.result);
    params.set("page", String(totalPages));
    redirect(`/projects/${projectSlug}/runs/${runId}?${params.toString()}`);
  }

  const hasFilters = !!(filters.type || filters.result);

  // Empty state
  if (evaluations.length === 0) {
    return (
      <div className="rounded-lg border p-12 text-center">
        {hasFilters ? (
          <>
            <h3 className="text-lg font-semibold">
              No evaluations match the current filters
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              <Link
                href={`/projects/${projectSlug}/runs/${runId}`}
                className="text-foreground underline underline-offset-4 hover:text-foreground/80"
              >
                Clear filters
              </Link>{" "}
              to see all evaluations.
            </p>
          </>
        ) : (
          <>
            <h3 className="text-lg font-semibold">
              No evaluations recorded for this run
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Evaluations will appear here once the test run completes.
            </p>
          </>
        )}
      </div>
    );
  }

  function buildHref(p: number) {
    const params = new URLSearchParams();
    if (filters.type) params.set("type", filters.type);
    if (filters.result) params.set("result", filters.result);
    params.set("page", String(p));
    return `?${params.toString()}`;
  }

  return (
    <div>
      <div className="overflow-x-auto rounded-lg border">
        <Table data-testid="evals-table">
          <TableCaption className="sr-only">
            Evaluations for this test run, page {page} of {totalPages}
          </TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Test Name</TableHead>
              <TableHead>Result</TableHead>
              <TableHead className="text-right">Score</TableHead>
              <TableHead className="w-10">
                <span className="sr-only">Expand</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {evaluations.map((evaluation) => (
              <ExpandableEvaluationRow
                key={evaluation.id}
                evaluation={evaluation}
                projectSlug={projectSlug}
                runId={runId}
              />
            ))}
          </TableBody>
        </Table>
      </div>
      <PaginationControls
        currentPage={page}
        totalPages={totalPages}
        totalCount={totalCount}
        perPage={perPage}
        noun="evaluations"
        buildHref={buildHref}
      />
    </div>
  );
}
