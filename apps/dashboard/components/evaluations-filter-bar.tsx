"use client";

import { useRouter, usePathname } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ASSERTION_TYPES = [
  { value: "all", label: "All types" },
  { value: "groundedness", label: "Groundedness" },
  { value: "pii", label: "PII" },
  { value: "sentiment", label: "Sentiment" },
  { value: "schema", label: "Schema" },
  { value: "fuzzy", label: "Fuzzy" },
] as const;

const RESULTS = [
  { value: "all", label: "All results" },
  { value: "pass", label: "Pass" },
  { value: "fail", label: "Fail" },
  { value: "inconclusive", label: "Inconclusive" },
] as const;

export function EvaluationsFilterBar({
  currentType,
  currentResult,
}: {
  currentType?: string;
  currentResult?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();

  function updateFilter(key: string, value: string) {
    // Build params from current filter props (avoids useSearchParams Suspense requirement)
    const params = new URLSearchParams();
    const state = { type: currentType, result: currentResult, [key]: value === "all" ? undefined : value };
    if (state.type) params.set("type", state.type);
    if (state.result) params.set("result", state.result);
    // Reset page to 1 on filter change (don't carry over page param)
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <div className="flex items-center gap-3">
      <Select
        value={currentType ?? "all"}
        onValueChange={(v) => updateFilter("type", v)}
      >
        <SelectTrigger className="w-[160px]" aria-label="Filter by assertion type">
          <SelectValue placeholder="All types" />
        </SelectTrigger>
        <SelectContent>
          {ASSERTION_TYPES.map((t) => (
            <SelectItem key={t.value} value={t.value}>
              {t.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={currentResult ?? "all"}
        onValueChange={(v) => updateFilter("result", v)}
      >
        <SelectTrigger className="w-[160px]" aria-label="Filter by result">
          <SelectValue placeholder="All results" />
        </SelectTrigger>
        <SelectContent>
          {RESULTS.map((r) => (
            <SelectItem key={r.value} value={r.value}>
              {r.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
