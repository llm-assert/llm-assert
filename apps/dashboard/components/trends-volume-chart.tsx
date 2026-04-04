"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useChartColors } from "@/lib/chart-colors";
import type { TrendBucket } from "@/lib/trends";

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function TrendsVolumeChart({ data }: { data: TrendBucket[] }) {
  const colors = useChartColors();

  const chartData = data.map((d) => ({
    date: formatDate(d.bucket),
    Passed: d.passed,
    Failed: d.failed,
    Inconclusive: d.inconclusive,
  }));

  return (
    <figure
      role="img"
      aria-label="Evaluation volume over time showing passed, failed, and inconclusive counts"
    >
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">
            Evaluation Volume
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div style={{ width: "100%", height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={chartData}
                margin={{ top: 5, right: 10, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="gradPassed" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor={colors.chart2}
                      stopOpacity={0.8}
                    />
                    <stop
                      offset="95%"
                      stopColor={colors.chart2}
                      stopOpacity={0.1}
                    />
                  </linearGradient>
                  <linearGradient id="gradFailed" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor={colors.chart5}
                      stopOpacity={0.8}
                    />
                    <stop
                      offset="95%"
                      stopColor={colors.chart5}
                      stopOpacity={0.1}
                    />
                  </linearGradient>
                  <linearGradient
                    id="gradInconclusive"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="5%"
                      stopColor={colors.chart3}
                      stopOpacity={0.8}
                    />
                    <stop
                      offset="95%"
                      stopColor={colors.chart3}
                      stopOpacity={0.1}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  className="stroke-border"
                />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  className="fill-muted-foreground"
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  className="fill-muted-foreground"
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--color-popover)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "var(--radius)",
                    color: "var(--color-popover-foreground)",
                  }}
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="Passed"
                  stackId="1"
                  stroke={colors.chart2}
                  fill="url(#gradPassed)"
                />
                <Area
                  type="monotone"
                  dataKey="Failed"
                  stackId="1"
                  stroke={colors.chart5}
                  fill="url(#gradFailed)"
                />
                <Area
                  type="monotone"
                  dataKey="Inconclusive"
                  stackId="1"
                  stroke={colors.chart3}
                  fill="url(#gradInconclusive)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </figure>
  );
}
