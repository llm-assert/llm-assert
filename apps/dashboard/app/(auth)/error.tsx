"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AuthError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("[auth/error]", {
      message: error.message,
      digest: error.digest,
    });
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
      <div className="flex size-12 items-center justify-center rounded-lg bg-destructive/10">
        <AlertTriangle className="size-6 text-destructive" aria-hidden="true" />
      </div>
      <h2 className="text-lg font-semibold">Something went wrong</h2>
      <p className="max-w-sm text-sm text-muted-foreground">
        There was an error loading this page. Please try again.
      </p>
      <div className="flex gap-2">
        <Button onClick={unstable_retry}>Try again</Button>
        <Button asChild variant="outline">
          <Link href="/sign-in">Back to Sign In</Link>
        </Button>
      </div>
    </div>
  );
}
