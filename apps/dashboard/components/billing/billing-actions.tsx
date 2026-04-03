"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

type BillingActionsProps =
  | { action: "checkout"; priceId: string; label?: string }
  | { action: "portal"; label?: string };

export function BillingActions(props: BillingActionsProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setIsLoading(true);
    setError(null);

    try {
      const url =
        props.action === "checkout"
          ? "/api/billing/checkout"
          : "/api/billing/portal";

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body:
          props.action === "checkout"
            ? JSON.stringify({ priceId: props.priceId })
            : undefined,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        if (res.status === 409) {
          setError(
            "You already have an active subscription. Use Manage Plan to make changes.",
          );
        } else if (res.status === 503) {
          setError(
            "Billing is temporarily unavailable. Please try again later.",
          );
        } else {
          setError(data?.error ?? "Something went wrong. Please try again.");
        }
        setIsLoading(false);
        return;
      }

      const { url: redirectUrl } = await res.json();
      setIsRedirecting(true);
      window.location.href = redirectUrl;
    } catch {
      setError("Network error. Please check your connection and try again.");
      setIsLoading(false);
    }
  }

  const defaultLabel = props.action === "portal" ? "Manage Plan" : "Upgrade";
  const label = isRedirecting
    ? "Redirecting..."
    : (props.label ?? defaultLabel);

  return (
    <div className="w-full space-y-2">
      <Button
        onClick={handleClick}
        disabled={isLoading || isRedirecting}
        variant={props.action === "portal" ? "outline" : "default"}
        className="w-full"
      >
        {(isLoading || isRedirecting) && (
          <Loader2 className="mr-2 size-4 animate-spin" />
        )}
        {label}
      </Button>
      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
