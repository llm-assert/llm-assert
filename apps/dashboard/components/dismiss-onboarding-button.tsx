"use client";

import { useTransition } from "react";
import { X } from "lucide-react";
import { dismissOnboardingAction } from "@/app/(dashboard)/actions";

export function DismissOnboardingButton() {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => startTransition(() => dismissOnboardingAction())}
      className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-50"
      aria-label="Dismiss onboarding checklist"
    >
      <X className="size-4" />
    </button>
  );
}
