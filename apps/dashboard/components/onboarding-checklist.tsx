import Link from "next/link";
import { Check, FolderPlus, Download, Play } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { CopyButton } from "@/components/copy-button";
import { CreateProjectDialog } from "@/components/create-project-dialog";
import { DismissOnboardingButton } from "@/components/dismiss-onboarding-button";
import type { OnboardingStep } from "@/lib/queries/get-onboarding-state";

interface OnboardingChecklistProps {
  step: Exclude<OnboardingStep, "complete">;
  variant: "full" | "banner";
  projectSlug?: string;
}

const steps = [
  {
    id: "create-project" as const,
    label: "Create your first project",
    description: "Set up a project to start collecting test results.",
    icon: FolderPlus,
  },
  {
    id: "install-reporter" as const,
    label: "Install the reporter",
    description: "Add @llmassert/playwright to your test suite.",
    icon: Download,
  },
  {
    id: "run-first-test" as const,
    label: "Run your first test",
    description:
      "Run your Playwright tests — results will appear here automatically.",
    icon: Play,
  },
];

function getStepStatus(
  stepId: string,
  currentStep: OnboardingStep,
): "complete" | "active" | "pending" {
  const order = ["create-project", "install-reporter", "run-first-test"];
  const currentIndex = order.indexOf(currentStep);
  const stepIndex = order.indexOf(stepId);

  if (stepIndex < currentIndex) return "complete";
  if (stepIndex === currentIndex) return "active";
  return "pending";
}

function StepIndicator({
  status,
}: {
  status: "complete" | "active" | "pending";
}) {
  if (status === "complete") {
    return (
      <div className="flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
        <Check className="size-4" />
      </div>
    );
  }
  if (status === "active") {
    return (
      <div className="flex size-8 items-center justify-center rounded-full border-2 border-primary bg-background">
        <div className="size-2.5 rounded-full bg-primary" />
      </div>
    );
  }
  return (
    <div className="flex size-8 items-center justify-center rounded-full border-2 border-muted-foreground/30 bg-background" />
  );
}

function ReporterSnippet({ projectSlug }: { projectSlug: string }) {
  const installCmd = "pnpm add -D @llmassert/playwright";
  const configSnippet = `// playwright.config.ts
reporter: [['@llmassert/playwright/reporter', {
  projectSlug: '${projectSlug}',
  apiKey: 'your-api-key',
}]]`;

  return (
    <div className="mt-3 space-y-3">
      <div className="space-y-1.5">
        <p className="text-xs font-medium text-muted-foreground">
          1. Install the package
        </p>
        <div className="flex items-center gap-2">
          <pre className="flex-1 rounded-md border bg-muted p-2 text-xs overflow-x-auto">
            <code>{installCmd}</code>
          </pre>
          <CopyButton text={installCmd} label="install command" />
        </div>
      </div>
      <div className="space-y-1.5">
        <p className="text-xs font-medium text-muted-foreground">
          2. Add the reporter config
        </p>
        <div className="flex items-start gap-2">
          <pre className="flex-1 rounded-md border bg-muted p-2 text-xs overflow-x-auto">
            <code>{configSnippet}</code>
          </pre>
          <CopyButton text={configSnippet} label="reporter config" />
        </div>
        <p className="text-xs text-muted-foreground">
          <Link
            href="/settings/api-keys"
            className="underline underline-offset-2 hover:text-foreground"
          >
            Get your API key
          </Link>{" "}
          from the settings page.
        </p>
      </div>
    </div>
  );
}

export function OnboardingChecklist({
  step,
  variant,
  projectSlug,
}: OnboardingChecklistProps) {
  const liveMessage =
    step === "install-reporter"
      ? "Step 1 complete: project created. Install the reporter to continue."
      : "";

  if (variant === "full") {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Card className="w-full max-w-xl">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold">Welcome to LLMAssert</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Get started in 3 steps
                </p>
              </div>
              <DismissOnboardingButton />
            </div>
            <nav aria-label="Getting started">
              <ol className="mt-6 space-y-4">
                {steps.map((s) => {
                  const status = getStepStatus(s.id, step);
                  const Icon = s.icon;
                  return (
                    <li
                      key={s.id}
                      className="flex gap-3"
                      aria-current={status === "active" ? "step" : undefined}
                    >
                      <StepIndicator status={status} />
                      <div className="flex-1 pt-0.5">
                        <p
                          className={
                            status === "complete"
                              ? "text-sm font-medium text-muted-foreground line-through"
                              : status === "active"
                                ? "text-sm font-medium"
                                : "text-sm font-medium text-muted-foreground"
                          }
                        >
                          <Icon className="mr-1.5 inline-block size-4 align-text-bottom" />
                          {s.label}
                        </p>
                        {(status === "active" || status === "pending") && (
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {s.description}
                          </p>
                        )}
                        {status === "active" && s.id === "create-project" && (
                          <div className="mt-3">
                            <CreateProjectDialog />
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </nav>
          </CardContent>
        </Card>
        <span aria-live="polite" aria-atomic="true" className="sr-only">
          {liveMessage}
        </span>
      </div>
    );
  }

  // variant === "banner"
  return (
    <>
      <Card className="mb-6">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <nav aria-label="Getting started">
                  <ol className="flex items-center gap-2">
                    {steps.map((s) => {
                      const status = getStepStatus(s.id, step);
                      return (
                        <li
                          key={s.id}
                          className="flex items-center gap-1.5"
                          aria-current={
                            status === "active" ? "step" : undefined
                          }
                        >
                          <StepIndicator status={status} />
                          <span
                            className={
                              status === "complete"
                                ? "text-xs text-muted-foreground line-through"
                                : status === "active"
                                  ? "text-xs font-medium"
                                  : "text-xs text-muted-foreground"
                            }
                          >
                            {s.label}
                          </span>
                          {s.id !== "run-first-test" && (
                            <span className="mx-1 text-muted-foreground/50">
                              →
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ol>
                </nav>
              </div>
              {step === "install-reporter" && projectSlug && (
                <>
                  <ReporterSnippet projectSlug={projectSlug} />
                  <p className="mt-2 text-xs text-muted-foreground">
                    Then run your Playwright tests — results will appear here
                    automatically.
                  </p>
                </>
              )}
            </div>
            <DismissOnboardingButton />
          </div>
        </CardContent>
      </Card>
      <span aria-live="polite" aria-atomic="true" className="sr-only">
        {liveMessage}
      </span>
    </>
  );
}
