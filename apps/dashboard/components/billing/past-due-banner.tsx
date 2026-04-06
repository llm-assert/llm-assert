import { AlertTriangle } from "lucide-react";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { BillingActions } from "./billing-actions";

export function PastDueBanner() {
  return (
    <Alert
      variant="destructive"
      role="alert"
      aria-atomic="true"
      aria-label="Billing alert"
      data-testid="billing-alert-banner"
    >
      <AlertTriangle aria-hidden="true" />
      <AlertTitle>
        <span className="sr-only">Error: </span>
        Payment past due
      </AlertTitle>
      <AlertDescription>
        <p>
          Your payment method failed. Assertion scoring will stop when your
          grace period ends — update your payment method to keep tests passing.
        </p>
        <div className="mt-2 w-full sm:w-48" data-testid="billing-alert-cta">
          <BillingActions action="portal" label="Update Payment Method" />
        </div>
      </AlertDescription>
    </Alert>
  );
}
