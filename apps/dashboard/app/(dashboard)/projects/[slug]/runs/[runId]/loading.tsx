import { Skeleton } from "@/components/ui/skeleton";
import { EvaluationsTableSkeleton } from "@/components/evaluations-table-skeleton";

export default function RunDetailLoading() {
  return (
    <div aria-busy="true" aria-label="Loading run details">
      {/* Header skeleton */}
      <div className="flex h-12 items-center gap-2 border-b px-4">
        <Skeleton className="h-4 w-64" />
      </div>

      <div className="flex-1 space-y-4 p-4">
        {/* Summary strip skeleton */}
        <div className="rounded-lg border p-4">
          <div className="flex flex-wrap items-center gap-6">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-16" />
            <div className="ml-auto flex items-center gap-3">
              <Skeleton className="h-4 w-8" />
              <Skeleton className="h-4 w-8" />
              <Skeleton className="h-4 w-8" />
              <Skeleton className="h-4 w-12" />
            </div>
          </div>
        </div>

        {/* Filter bar skeleton */}
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-[160px]" />
          <Skeleton className="h-9 w-[160px]" />
        </div>

        {/* Table skeleton */}
        <EvaluationsTableSkeleton />
      </div>
    </div>
  );
}
