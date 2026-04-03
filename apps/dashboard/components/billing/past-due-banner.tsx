import { AlertTriangle } from "lucide-react";
import { BillingActions } from "./billing-actions";

export function PastDueBanner() {
  return (
    <div
      role="alert"
      className="flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-center gap-3">
        <AlertTriangle className="size-5 shrink-0" />
        <p className="text-sm">
          Your payment method failed. Update it to avoid service interruption.
        </p>
      </div>
      <div className="shrink-0 sm:w-48">
        <BillingActions action="portal" label="Update Payment Method" />
      </div>
    </div>
  );
}
