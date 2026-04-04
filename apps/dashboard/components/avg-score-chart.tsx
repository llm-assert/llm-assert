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

export function AvgScoreChart({ data }: { data: TrendBucket[] }) {
  const colors = useChartColors();

  const chartData = data.map((d) => ({
    date: formatDate(d.bucket),
    "Avg Score":
      d.avg_score != null ? Number(Number(d.avg_score).toFixed(3)) : null,
  }));

  return (
    <figure role="img" aria-label="Daily average evaluation score over time">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Avg Score</CardTitle>
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
                  domain={[0, 1]}
                  tickFormatter={(v) => v.toFixed(1)}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--color-popover)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "var(--radius)",
                    color: "var(--color-popover-foreground)",
                  }}
                  formatter={(value) => [Number(value).toFixed(3), "Avg Score"]}
                />
                <Line
                  type="monotone"
                  dataKey="Avg Score"
                  stroke={colors.chart1}
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
