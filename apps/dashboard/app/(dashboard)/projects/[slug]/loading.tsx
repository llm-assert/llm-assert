import { Skeleton } from "@/components/ui/skeleton";
import { DashboardHeader } from "@/components/dashboard-header";
import { StatCardSkeleton } from "@/components/stat-card-skeleton";
import { RecentRunsTableSkeleton } from "@/components/recent-runs-table-skeleton";

export default function Loading() {
  return (
    <>
      <DashboardHeader
        breadcrumbs={[
          { label: "Projects", href: "/" },
          { label: "Loading..." },
        ]}
      />
      <div className="flex-1 space-y-6 p-4">
        <div>
          <Skeleton className="h-8 w-64" />
          <Skeleton className="mt-1 h-4 w-96" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
        </div>
        <RecentRunsTableSkeleton />
      </div>
    </>
  );
}
