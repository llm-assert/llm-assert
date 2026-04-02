import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { DashboardHeader } from "@/components/dashboard-header";

function SkeletonCard() {
  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </CardHeader>
      <CardContent className="space-y-3">
        <Skeleton className="h-2 w-full rounded-full" />
        <Skeleton className="h-3 w-2/3" />
        <Skeleton className="h-3 w-1/3" />
      </CardContent>
    </Card>
  );
}

export default function Loading() {
  return (
    <>
      <DashboardHeader />
      <div className="flex-1 p-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-9 w-28" />
        </div>
        <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <li>
            <SkeletonCard />
          </li>
          <li>
            <SkeletonCard />
          </li>
          <li>
            <SkeletonCard />
          </li>
        </ul>
      </div>
    </>
  );
}
