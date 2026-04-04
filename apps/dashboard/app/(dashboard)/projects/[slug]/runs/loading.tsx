import { DashboardHeader } from "@/components/dashboard-header";
import { RunsTableSkeleton } from "@/components/runs-table-skeleton";

export default function Loading() {
  return (
    <>
      <DashboardHeader
        breadcrumbs={[
          { label: "Projects", href: "/dashboard" },
          { label: "Loading..." },
          { label: "Runs" },
        ]}
      />
      <div className="flex-1 p-4">
        <RunsTableSkeleton />
      </div>
    </>
  );
}
