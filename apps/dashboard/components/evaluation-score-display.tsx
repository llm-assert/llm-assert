import { formatScore } from "@/lib/format";

const scoreColors: Record<string, string> = {
  pass: "text-emerald-500",
  fail: "text-red-500",
  inconclusive: "text-amber-500",
};

export function EvaluationScoreDisplay({
  score,
  result,
  threshold,
}: {
  score: number | null;
  result: string;
  threshold: number | null;
}) {
  return (
    <div className="flex flex-col items-center gap-1 py-2">
      <p
        className={`text-5xl font-bold tabular-nums ${scoreColors[result] ?? ""}`}
        aria-label={`Score: ${formatScore(score)}, Result: ${result}`}
      >
        {formatScore(score)}
      </p>
      {threshold !== null && score !== null && (
        <p className="text-sm text-muted-foreground">
          Threshold: {threshold.toFixed(2)}
        </p>
      )}
    </div>
  );
}
