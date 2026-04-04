"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useChartColors } from "@/lib/chart-colors";
import type { AssertionBreakdownBucket } from "@/lib/queries/get-assertion-breakdown";

function buildAriaLabel(data: AssertionBreakdownBucket[]): string {
  const total = data.reduce((sum, d) => sum + d.total, 0);
  const parts = data.map(
    (d) =>
      `${d.assertion_type}: ${d.total} (${d.passed} passed, ${d.failed} failed, ${d.inconclusive} inconclusive)`,
  );
  return `Assertion type breakdown: ${total} total evaluations. ${parts.join(". ")}`;
}

export function AssertionBreakdownChart({
  data,
}: {
  data: AssertionBreakdownBucket[];
}) {
  const colors = useChartColors();

  const chartData = data.map((d) => ({
    name: d.assertion_type,
    Passed: d.passed,
    Failed: d.failed,
    Inconclusive: d.inconclusive,
  }));

  return (
    <figure role="img" aria-label={buildAriaLabel(data)}>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">
            Assertion Type Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div style={{ width: "100%", height: Math.max(200, data.length * 48) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ top: 5, right: 10, left: 0, bottom: 0 }}
              >
                <XAxis
                  type="number"
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  className="fill-muted-foreground"
                  allowDecimals={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  className="fill-muted-foreground"
                  width={100}
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
                <Bar
                  dataKey="Passed"
                  stackId="a"
                  fill={colors.chart2}
                  isAnimationActive={false}
                />
                <Bar
                  dataKey="Failed"
                  stackId="a"
                  fill={colors.chart5}
                  isAnimationActive={false}
                />
                <Bar
                  dataKey="Inconclusive"
                  stackId="a"
                  fill={colors.chart3}
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </figure>
  );
}
