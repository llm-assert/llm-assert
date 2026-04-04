"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { TableCell, TableRow } from "@/components/ui/table";
import { ResultBadge } from "@/components/result-badge";
import { DetailSection } from "@/components/detail-section";
import { Badge } from "@/components/ui/badge";
import { formatScore, formatLatency, formatCost } from "@/lib/format";
import type { Evaluation } from "@/lib/types";

export function ExpandableEvaluationRow({
  evaluation,
  projectSlug,
  runId,
}: {
  evaluation: Evaluation;
  projectSlug: string;
  runId: string;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const detailId = `eval-detail-${evaluation.id}`;

  return (
    <>
      <TableRow className="group" data-testid={`eval-row-${evaluation.id}`}>
        <TableCell className="text-sm capitalize">
          {evaluation.assertion_type}
        </TableCell>
        <TableCell className="max-w-[250px] truncate text-sm">
          <Link
            href={`/projects/${projectSlug}/runs/${runId}/evaluations/${evaluation.id}`}
            className="hover:underline underline-offset-4"
          >
            {evaluation.test_name}
          </Link>
        </TableCell>
        <TableCell>
          <ResultBadge result={evaluation.result} />
        </TableCell>
        <TableCell className="tabular-nums text-sm text-right">
          {formatScore(evaluation.score)}
        </TableCell>
        <TableCell className="w-10">
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            aria-expanded={isExpanded}
            aria-controls={detailId}
            className="flex size-7 items-center justify-center rounded-md hover:bg-muted transition-colors"
            aria-label={`${isExpanded ? "Collapse" : "Expand"} evaluation details`}
          >
            <ChevronRight
              className={`size-4 transition-transform ${isExpanded ? "rotate-90" : ""}`}
            />
          </button>
        </TableCell>
      </TableRow>

      {isExpanded && (
        <TableRow id={detailId}>
          <TableCell colSpan={5} className="bg-muted/30 p-0">
            <div className="max-h-[400px] overflow-auto p-4 space-y-4 text-sm">
              <DetailSection label="Input">
                {evaluation.input_text ?? (
                  <span className="text-muted-foreground">—</span>
                )}
              </DetailSection>

              {evaluation.context_text && (
                <DetailSection label="Context">
                  {evaluation.context_text}
                </DetailSection>
              )}

              {evaluation.expected_value && (
                <DetailSection label="Expected Value">
                  <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                    {evaluation.expected_value}
                  </code>
                </DetailSection>
              )}

              <DetailSection label="Reasoning">
                {evaluation.reasoning ?? (
                  <span className="text-muted-foreground">—</span>
                )}
              </DetailSection>

              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t pt-3 text-muted-foreground">
                {evaluation.score !== null && (
                  <span>
                    Score:{" "}
                    <strong className="text-foreground">
                      {formatScore(evaluation.score)}
                    </strong>
                    {evaluation.threshold !== null && (
                      <> / threshold: {evaluation.threshold.toFixed(2)}</>
                    )}
                  </span>
                )}

                {evaluation.judge_model && (
                  <span className="inline-flex items-center gap-1.5">
                    {evaluation.judge_model}
                    {evaluation.fallback_used && (
                      <Badge
                        variant="outline"
                        className="bg-amber-500/10 text-amber-500 border-amber-500/20 text-xs"
                      >
                        Fallback
                      </Badge>
                    )}
                  </span>
                )}

                {evaluation.judge_latency_ms !== null && (
                  <span>{formatLatency(evaluation.judge_latency_ms)}</span>
                )}

                {evaluation.judge_cost_usd !== null && (
                  <span>{formatCost(evaluation.judge_cost_usd)}</span>
                )}

                {evaluation.test_file && (
                  <span className="font-mono text-xs">
                    {evaluation.test_file}
                  </span>
                )}
              </div>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
