import { Card, CardContent } from "@/components/ui/card";
import { CopyButton } from "@/components/copy-button";
import type { Evaluation } from "@/lib/types";

export function EvaluationContentPanel({
  evaluation,
}: {
  evaluation: Evaluation;
}) {
  return (
    <div data-testid="eval-content-panel" className="space-y-4">
      <ContentSection label="Input" text={evaluation.input_text} />

      {evaluation.context_text && (
        <ContentSection label="Context" text={evaluation.context_text} />
      )}

      {evaluation.expected_value && (
        <ContentSection
          label="Expected Value"
          text={evaluation.expected_value}
          mono
        />
      )}

      <ContentSection label="Reasoning" text={evaluation.reasoning} />
    </div>
  );
}

function ContentSection({
  label,
  text,
  mono,
}: {
  label: string;
  text: string | null;
  mono?: boolean;
}) {
  const content = text ?? "—";
  const hasContent = text !== null;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-2 mb-2">
          <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </h3>
          {hasContent && <CopyButton text={content} label={label} />}
        </div>
        <div
          className={`text-sm max-h-[500px] overflow-y-auto whitespace-pre-wrap break-words ${
            mono ? "font-mono text-xs rounded bg-muted px-2 py-1.5" : ""
          } ${!hasContent ? "text-muted-foreground" : ""}`}
        >
          {content}
        </div>
      </CardContent>
    </Card>
  );
}
