"use client";

import { useState, useEffect } from "react";
import { AlertTriangle, X } from "lucide-react";
import Link from "next/link";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { PlanName } from "@/lib/plans.client";

const DISMISS_KEY = "billing-banner-dismissed";

function formatResetDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
  });
}

interface QuotaWarningBannerProps {
  used: number;
  limit: number;
  remaining: number;
  plan: PlanName;
  nextResetDate: string | null;
}

export function QuotaWarningBanner({
  used,
  limit,
  remaining,
  plan,
  nextResetDate,
}: QuotaWarningBannerProps) {
  // Start dismissed to avoid hydration flash — useEffect reads sessionStorage
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(sessionStorage.getItem(DISMISS_KEY) === "1");
  }, []);

  if (dismissed) return null;

  const resetLabel = plan === "free" ? "Resets" : "Renews";

  return (
    <Alert
      variant="warning"
      role="status"
      aria-atomic="true"
      aria-label="Usage warning"
      data-testid="quota-warning-banner"
    >
      <AlertTriangle aria-hidden="true" />
      <AlertTitle>
        <span className="sr-only">Warning: </span>
        Assertion budget running low
      </AlertTitle>
      <AlertDescription>
        <p>
          {remaining.toLocaleString()} assertion evaluations remaining this
          month ({used.toLocaleString()} of {limit.toLocaleString()} used).
          Assertions may become inconclusive when the limit is reached.
          {nextResetDate && (
            <>
              {" "}
              {resetLabel}{" "}
              <time
                dateTime={nextResetDate}
                data-testid="quota-warning-reset-date"
              >
                {formatResetDate(nextResetDate)}
              </time>
              .
            </>
          )}
        </p>
        <div className="mt-2" data-testid="quota-warning-cta">
          <Button variant="outline" size="sm" asChild>
            <Link href="/settings/billing">View Plans</Link>
          </Button>
        </div>
      </AlertDescription>
      <button
        type="button"
        onClick={() => {
          sessionStorage.setItem(DISMISS_KEY, "1");
          setDismissed(true);
        }}
        className="absolute right-3 top-3 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        aria-label="Dismiss usage warning"
        data-testid="quota-warning-dismiss"
      >
        <X className="size-4" />
      </button>
    </Alert>
  );
}

interface QuotaExceededBannerProps {
  used: number;
  limit: number;
  plan: PlanName;
  nextResetDate: string | null;
}

export function QuotaExceededBanner({
  limit,
  used,
  plan,
  nextResetDate,
}: QuotaExceededBannerProps) {
  const isFree = plan === "free";

  return (
    <Alert
      variant="destructive"
      role="alert"
      aria-atomic="true"
      aria-label="Billing alert"
      data-testid="quota-exceeded-banner"
    >
      <AlertTriangle aria-hidden="true" />
      <AlertTitle>
        <span className="sr-only">Error: </span>
        Evaluation limit reached
      </AlertTitle>
      <AlertDescription>
        <p>
          You&apos;ve used all {limit.toLocaleString()} assertion evaluations
          this month ({used.toLocaleString()} used).{" "}
          {isFree && nextResetDate ? (
            <>
              Resets{" "}
              <time
                dateTime={nextResetDate}
                data-testid="quota-exceeded-reset-date"
              >
                {formatResetDate(nextResetDate)}
              </time>
              . Upgrade your plan to continue running assertions now.
            </>
          ) : nextResetDate ? (
            <>
              Renews{" "}
              <time
                dateTime={nextResetDate}
                data-testid="quota-exceeded-reset-date"
              >
                {formatResetDate(nextResetDate)}
              </time>
              . Upgrade your plan to increase your limit.
            </>
          ) : (
            <>Upgrade your plan to continue running assertions.</>
          )}
        </p>
        <div className="mt-2" data-testid="quota-exceeded-cta">
          <Button variant="outline" size="sm" asChild>
            <Link href="/settings/billing">Upgrade Plan</Link>
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
