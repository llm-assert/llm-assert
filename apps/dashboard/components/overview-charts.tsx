"use client";

import { use } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OverviewSparkline } from "@/components/overview-sparkline";
import { AssertionBreakdownChart } from "@/components/assertion-breakdown-chart";
import { BarChart3 } from "lucide-react";
import type { TrendBucket } from "@/lib/trends";
import type { AssertionBreakdownBucket } from "@/lib/queries/get-assertion-breakdown";

export function OverviewSparklineCard({
  dataPromise,
}: {
  dataPromise: Promise<TrendBucket[]>;
}) {
  const trends = use(dataPromise);

  const hasTrends = trends.some((d) => d.total > 0);
  const totalEvals = trends.reduce((sum, d) => sum + d.total, 0);

  if (!hasTrends) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">
            Evaluation Volume — Last 7 Days
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-8 text-center">
          <BarChart3 className="size-5 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">
            No evaluation data yet
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">
          Evaluation Volume — Last 7 Days
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold tabular-nums">
          {totalEvals.toLocaleString()}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">evaluations</p>
        <div className="mt-3">
          <OverviewSparkline data={trends} />
        </div>
      </CardContent>
    </Card>
  );
}

export function OverviewBreakdownCard({
  dataPromise,
}: {
  dataPromise: Promise<AssertionBreakdownBucket[]>;
}) {
  const breakdown = use(dataPromise);

  if (breakdown.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">
            Assertion Type Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-8 text-center">
          <BarChart3 className="size-5 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">
            Run some tests to see assertion type breakdown
          </p>
        </CardContent>
      </Card>
    );
  }

  return <AssertionBreakdownChart data={breakdown} />;
}
