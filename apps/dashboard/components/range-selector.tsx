"use client";

import { useRouter, usePathname } from "next/navigation";

const RANGES = [
  { label: "7D", value: "7d" },
  { label: "30D", value: "30d" },
  { label: "90D", value: "90d" },
] as const;

export function RangeSelector({ range }: { range: string }) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <div className="inline-flex items-center gap-1 rounded-lg bg-muted p-1">
      {RANGES.map((r) => (
        <button
          key={r.value}
          onClick={() => router.push(`${pathname}?range=${r.value}`)}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            range === r.value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}
