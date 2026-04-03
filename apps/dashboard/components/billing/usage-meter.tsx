import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export function UsageMeter({ used, limit }: { used: number; limit: number }) {
  const percentage = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
  const isWarning = percentage >= 80;

  const formattedUsed = used.toLocaleString();
  const formattedLimit = limit.toLocaleString();

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-medium">Evaluations this period</span>
        <span className={cn("tabular-nums", isWarning && "text-amber-600")}>
          {formattedUsed} / {formattedLimit}
        </span>
      </div>
      <Progress
        value={used}
        max={limit}
        aria-label={`${formattedUsed} of ${formattedLimit} evaluations used`}
        className={cn(
          isWarning && "[&>[data-slot=progress-indicator]]:bg-amber-500",
        )}
      />
      {isWarning && (
        <p className="text-xs text-amber-600">
          You&apos;ve used {Math.round(percentage)}% of your evaluation quota.
          Consider upgrading your plan.
        </p>
      )}
    </div>
  );
}
