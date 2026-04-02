"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { TableCell, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatScore } from "@/lib/format";

type Evaluation = {
  id: string;
  assertion_type: string;
  test_name: string;
  test_file: string | null;
  input_text: string | null;
  context_text: string | null;
  expected_value: string | null;
  result: string;
  score: number | null;
  reasoning: string | null;
  judge_model: string | null;
  judge_latency_ms: number | null;
  judge_cost_usd: number | null;
  fallback_used: boolean;
  threshold: number | null;
};

function ResultBadge({ result }: { result: string }) {
  const styles: Record<string, string> = {
    pass: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    fail: "bg-red-500/10 text-red-500 border-red-500/20",
    inconclusive: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  };

  return (
    <Badge
      variant="outline"
      className={`${styles[result] ?? ""} capitalize`}
    >
      {result}
      <span className="sr-only"> result</span>
    </Badge>
  );
}

export function ExpandableEvaluationRow({
  evaluation,
}: {
  evaluation: Evaluation;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const detailId = `eval-detail-${evaluation.id}`;

  return (
    <>
      <TableRow className="group">
        <TableCell className="text-sm capitalize">
          {evaluation.assertion_type}
        </TableCell>
        <TableCell className="max-w-[250px] truncate text-sm">
          {evaluation.test_name}
        </TableCell>
        <TableCell>
          <ResultBadge result={evaluation.result} />
        </TableCell>
        <TableCell className="tabular-nums text-sm text-right">
          {formatScore(evaluation.score)}
        </TableCell>
        <TableCell className="w-10">
          <button
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
                    Score: <strong className="text-foreground">{formatScore(evaluation.score)}</strong>
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
                  <span>
                    {(evaluation.judge_latency_ms / 1000).toFixed(1)}s
                  </span>
                )}

                {evaluation.judge_cost_usd !== null && (
                  <span>${evaluation.judge_cost_usd.toFixed(4)}</span>
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

function DetailSection({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">
        {label}
      </dt>
      <dd className="whitespace-pre-wrap break-words">{children}</dd>
    </div>
  );
}
