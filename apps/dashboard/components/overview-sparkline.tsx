"use client";

import { useId } from "react";
import { AreaChart, Area, ResponsiveContainer } from "recharts";
import { useChartColors } from "@/lib/chart-colors";
import type { TrendBucket } from "@/lib/trends";

export function OverviewSparkline({ data }: { data: TrendBucket[] }) {
  const id = useId();
  const colors = useChartColors();

  const chartData = data.map((d) => ({
    Passed: d.passed,
    Failed: d.failed,
    Inconclusive: d.inconclusive,
  }));

  const total = data.reduce((sum, d) => sum + d.total, 0);
  const passed = data.reduce((sum, d) => sum + d.passed, 0);
  const failed = data.reduce((sum, d) => sum + d.failed, 0);
  const inconclusive = data.reduce((sum, d) => sum + d.inconclusive, 0);

  return (
    <figure
      role="img"
      aria-label={`Evaluation volume sparkline: ${total.toLocaleString()} evaluations over the last ${data.length} days (${passed} passed, ${failed} failed, ${inconclusive} inconclusive)`}
    >
      <div style={{ width: "100%", height: 60 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={chartData}
            margin={{ top: 2, right: 0, left: 0, bottom: 2 }}
          >
            <defs>
              <linearGradient id={`${id}-passed`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={colors.chart2} stopOpacity={0.6} />
                <stop
                  offset="95%"
                  stopColor={colors.chart2}
                  stopOpacity={0.05}
                />
              </linearGradient>
              <linearGradient id={`${id}-failed`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={colors.chart5} stopOpacity={0.6} />
                <stop
                  offset="95%"
                  stopColor={colors.chart5}
                  stopOpacity={0.05}
                />
              </linearGradient>
              <linearGradient
                id={`${id}-inconclusive`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="5%" stopColor={colors.chart3} stopOpacity={0.6} />
                <stop
                  offset="95%"
                  stopColor={colors.chart3}
                  stopOpacity={0.05}
                />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="Passed"
              stackId="1"
              stroke={colors.chart2}
              strokeWidth={1.5}
              fill={`url(#${id}-passed)`}
              dot={false}
              isAnimationActive={false}
            />
            <Area
              type="monotone"
              dataKey="Failed"
              stackId="1"
              stroke={colors.chart5}
              strokeWidth={1.5}
              fill={`url(#${id}-failed)`}
              dot={false}
              isAnimationActive={false}
            />
            <Area
              type="monotone"
              dataKey="Inconclusive"
              stackId="1"
              stroke={colors.chart3}
              strokeWidth={1.5}
              fill={`url(#${id}-inconclusive)`}
              dot={false}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}
