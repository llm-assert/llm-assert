import { Cpu, Clock, DollarSign, FileText, TestTube } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ResultBadge } from "@/components/result-badge";
import { EvaluationScoreDisplay } from "@/components/evaluation-score-display";
import { CopyLinkButton } from "@/components/copy-link-button";
import { formatLatency, formatCost, formatRelativeTime } from "@/lib/format";
import type { Evaluation } from "@/lib/types";

export function EvaluationMetadataPanel({
  evaluation,
  pagePath,
}: {
  evaluation: Evaluation;
  pagePath: string;
}) {
  return (
    <Card data-testid="eval-metadata-panel">
      <CardContent className="space-y-5 p-5">
        {/* Result + Score */}
        <div className="flex flex-col items-center gap-2">
          <ResultBadge result={evaluation.result} />
          <EvaluationScoreDisplay
            score={evaluation.score}
            result={evaluation.result}
            threshold={evaluation.threshold}
          />
        </div>

        {/* Assertion Type */}
        <div className="space-y-3 border-t pt-4">
          <MetadataRow icon={TestTube} label="Type">
            <span className="capitalize">{evaluation.assertion_type}</span>
          </MetadataRow>

          {/* Test Info */}
          <MetadataRow icon={FileText} label="Test">
            <span
              className="truncate max-w-[200px]"
              title={evaluation.test_name}
            >
              {evaluation.test_name}
            </span>
          </MetadataRow>

          {evaluation.test_file && (
            <div className="pl-7 -mt-2">
              <span className="font-mono text-xs text-muted-foreground">
                {evaluation.test_file}
              </span>
            </div>
          )}
        </div>

        {/* Judge Info */}
        <div className="space-y-3 border-t pt-4">
          {evaluation.judge_model && (
            <MetadataRow icon={Cpu} label="Model">
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
            </MetadataRow>
          )}

          {evaluation.judge_latency_ms !== null && (
            <MetadataRow icon={Clock} label="Latency">
              {formatLatency(evaluation.judge_latency_ms)}
            </MetadataRow>
          )}

          {evaluation.judge_cost_usd !== null && (
            <MetadataRow icon={DollarSign} label="Cost">
              {formatCost(evaluation.judge_cost_usd)}
            </MetadataRow>
          )}
        </div>

        {/* Timing + Actions */}
        <div className="space-y-3 border-t pt-4">
          <div className="text-xs text-muted-foreground">
            {formatRelativeTime(evaluation.created_at)}
          </div>
          <div className="flex items-center gap-2">
            <CopyLinkButton path={pagePath} />
            <span className="text-xs text-muted-foreground">Copy link</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MetadataRow({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <Icon className="size-4 text-muted-foreground mt-0.5 shrink-0" />
      <div className="min-w-0">
        <span className="sr-only">{label}: </span>
        {children}
      </div>
    </div>
  );
}
