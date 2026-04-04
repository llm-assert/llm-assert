"use client";

import { use } from "react";
import { TrendsVolumeChart } from "@/components/trends-volume-chart";
import { PassRateChart } from "@/components/pass-rate-chart";
import { AvgScoreChart } from "@/components/avg-score-chart";
import { TrendingUp } from "lucide-react";
import type { TrendBucket } from "@/lib/trends";

export function TrendsCharts({
  dataPromise,
}: {
  dataPromise: Promise<TrendBucket[]>;
}) {
  const data = use(dataPromise);

  const hasData = data.some((d) => d.total > 0);

  if (!hasData) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="flex size-12 items-center justify-center rounded-lg bg-muted">
          <TrendingUp className="size-6 text-muted-foreground" />
        </div>
        <h2 className="mt-4 text-lg font-semibold">No evaluation data</h2>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Run some tests with the LLMAssert reporter to see trends here.
        </p>
      </div>
    );
  }

  return (
    <>
      <TrendsVolumeChart data={data} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <PassRateChart data={data} />
        <AvgScoreChart data={data} />
      </div>
    </>
  );
}
