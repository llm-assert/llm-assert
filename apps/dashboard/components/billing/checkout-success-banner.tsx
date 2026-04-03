import { CheckCircle2 } from "lucide-react";

export function CheckoutSuccessBanner({ show }: { show: boolean }) {
  if (!show) return null;

  return (
    <div
      role="alert"
      className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 p-4 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200"
    >
      <CheckCircle2 className="size-5 shrink-0" />
      <p className="text-sm">
        Your plan is being activated. This may take a moment to reflect.
      </p>
    </div>
  );
}
