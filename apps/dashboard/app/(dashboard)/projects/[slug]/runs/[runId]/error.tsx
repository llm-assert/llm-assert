"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function RunDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Run detail error:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
      <div className="flex size-12 items-center justify-center rounded-lg bg-destructive/10">
        <AlertTriangle className="size-6 text-destructive" />
      </div>
      <h2 className="text-lg font-semibold">Failed to load run details</h2>
      <p className="max-w-sm text-sm text-muted-foreground">
        There was an error loading the run details. Please try again.
      </p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
