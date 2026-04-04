"use client";

import { useEffect, useState } from "react";

const CHART_CSS_VARS = [
  "--color-chart-1",
  "--color-chart-2",
  "--color-chart-3",
  "--color-chart-4",
  "--color-chart-5",
] as const;

export interface ChartColors {
  chart1: string;
  chart2: string;
  chart3: string;
  chart4: string;
  chart5: string;
}

const FALLBACK_COLORS: ChartColors = {
  chart1: "#e97316", // oklch(0.646 0.222 41.116)
  chart2: "#0d9488", // oklch(0.6 0.118 184.704)
  chart3: "#3b5998", // oklch(0.398 0.07 227.392)
  chart4: "#eab308", // oklch(0.828 0.189 84.429)
  chart5: "#d97706", // oklch(0.769 0.188 70.08)
};

function resolveColors(): ChartColors {
  if (typeof window === "undefined") return FALLBACK_COLORS;

  const style = getComputedStyle(document.documentElement);
  const get = (v: string) => style.getPropertyValue(v).trim() || undefined;

  return {
    chart1: get(CHART_CSS_VARS[0]) ?? FALLBACK_COLORS.chart1,
    chart2: get(CHART_CSS_VARS[1]) ?? FALLBACK_COLORS.chart2,
    chart3: get(CHART_CSS_VARS[2]) ?? FALLBACK_COLORS.chart3,
    chart4: get(CHART_CSS_VARS[3]) ?? FALLBACK_COLORS.chart4,
    chart5: get(CHART_CSS_VARS[4]) ?? FALLBACK_COLORS.chart5,
  };
}

export function useChartColors(): ChartColors {
  const [colors, setColors] = useState<ChartColors>(FALLBACK_COLORS);

  useEffect(() => {
    setColors(resolveColors());

    const observer = new MutationObserver(() => {
      setColors(resolveColors());
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);

  return colors;
}
