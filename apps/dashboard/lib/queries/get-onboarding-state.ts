export type OnboardingStep = "create-project" | "install-reporter" | "complete";

export type OnboardingState = {
  step: OnboardingStep;
  showBanner: boolean;
};

export function getOnboardingState(
  projects: unknown[],
  runs: unknown[],
  userMetadata?: Record<string, unknown> | null,
): OnboardingState {
  if (userMetadata?.onboarding_dismissed === true) {
    return { step: "complete", showBanner: false };
  }

  if (projects.length === 0) {
    return { step: "create-project", showBanner: false };
  }

  if (runs.length === 0) {
    return { step: "install-reporter", showBanner: true };
  }

  return { step: "complete", showBanner: false };
}
