"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useChartColors } from "@/lib/chart-colors";
import type { TrendBucket } from "@/lib/trends";

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function PassRateChart({ data }: { data: TrendBucket[] }) {
  const colors = useChartColors();

  const chartData = data.map((d) => ({
    date: formatDate(d.bucket),
    "Pass Rate":
      d.total > 0 ? Number(((d.passed / d.total) * 100).toFixed(1)) : null,
  }));

  return (
    <figure role="img" aria-label="Daily pass rate percentage over time">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Pass Rate %</CardTitle>
        </CardHeader>
        <CardContent>
          <div style={{ width: "100%", height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{ top: 5, right: 10, left: 0, bottom: 0 }}
              >
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
                  domain={[0, 100]}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--color-popover)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "var(--radius)",
                    color: "var(--color-popover-foreground)",
                  }}
                  formatter={(value) => [`${value}%`, "Pass Rate"]}
                />
                <Line
                  type="monotone"
                  dataKey="Pass Rate"
                  stroke={colors.chart2}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                  connectNulls={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </figure>
  );
}
