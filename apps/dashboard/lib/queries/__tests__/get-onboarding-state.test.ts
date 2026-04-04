import { describe, it, expect } from "vitest";
import { getOnboardingState } from "@/lib/queries/get-onboarding-state";

describe("getOnboardingState", () => {
  it("returns create-project step when no projects exist", () => {
    const result = getOnboardingState([], []);
    expect(result).toEqual({ step: "create-project", showBanner: false });
  });

  it("returns install-reporter step with banner when projects exist but no runs", () => {
    const result = getOnboardingState([{ id: "p1" }], []);
    expect(result).toEqual({ step: "install-reporter", showBanner: true });
  });

  it("returns complete when projects and runs exist", () => {
    const result = getOnboardingState([{ id: "p1" }], [{ id: "r1" }]);
    expect(result).toEqual({ step: "complete", showBanner: false });
  });

  it("returns complete when onboarding_dismissed is true regardless of data", () => {
    const result = getOnboardingState([], [], {
      onboarding_dismissed: true,
    });
    expect(result).toEqual({ step: "complete", showBanner: false });
  });

  it("does not treat falsy onboarding_dismissed as dismissed", () => {
    const result = getOnboardingState([], [], {
      onboarding_dismissed: false,
    });
    expect(result).toEqual({ step: "create-project", showBanner: false });
  });

  it("handles null userMetadata", () => {
    const result = getOnboardingState([{ id: "p1" }], [], null);
    expect(result).toEqual({ step: "install-reporter", showBanner: true });
  });

  it("handles undefined userMetadata", () => {
    const result = getOnboardingState([{ id: "p1" }], [{ id: "r1" }]);
    expect(result).toEqual({ step: "complete", showBanner: false });
  });
});
