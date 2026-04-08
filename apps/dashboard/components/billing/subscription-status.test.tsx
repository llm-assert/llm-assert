import { render, screen } from "@testing-library/react";
import {
  getSubscriptionDisplayState,
  SubscriptionStatus,
} from "./subscription-status";

// ---------------------------------------------------------------------------
// Mock plans.client — avoid importing server-only config
// ---------------------------------------------------------------------------

vi.mock("@/lib/plans.client", () => ({
  getPlanDisplay: (plan: string) => ({
    label: plan === "free" ? "Free" : plan === "pro" ? "Pro" : "Starter",
  }),
}));

// ---------------------------------------------------------------------------
// Unit tests: getSubscriptionDisplayState
// ---------------------------------------------------------------------------

describe("getSubscriptionDisplayState", () => {
  it("returns Active/default/Renews for active subscription", () => {
    const result = getSubscriptionDisplayState("active", false);
    expect(result).toEqual({
      label: "Active",
      badgeVariant: "default",
      datePrefix: "Renews",
    });
  });

  it("returns Canceling/warning/Cancels for active + cancelAtPeriodEnd", () => {
    const result = getSubscriptionDisplayState("active", true);
    expect(result).toEqual({
      label: "Canceling",
      badgeVariant: "warning",
      datePrefix: "Cancels",
    });
  });

  it("returns Past due/destructive/Ended for past_due", () => {
    const result = getSubscriptionDisplayState("past_due", false);
    expect(result).toEqual({
      label: "Past due",
      badgeVariant: "destructive",
      datePrefix: "Ended",
    });
  });

  it("returns Canceled/secondary/Ended for canceled", () => {
    const result = getSubscriptionDisplayState("canceled", false);
    expect(result).toEqual({
      label: "Canceled",
      badgeVariant: "secondary",
      datePrefix: "Ended",
    });
  });
});

// ---------------------------------------------------------------------------
// Component tests: SubscriptionStatus
// ---------------------------------------------------------------------------

describe("SubscriptionStatus", () => {
  it("renders amber Canceling badge when cancelAtPeriodEnd is true", () => {
    render(
      <SubscriptionStatus
        subscription={{
          plan: "pro",
          status: "active",
          currentPeriodEnd: "2026-05-01T00:00:00Z",
          cancelAtPeriodEnd: true,
          nextResetDate: null,
        }}
      />,
    );

    const badge = screen.getByTestId("subscription-status-badge");
    expect(badge).toHaveTextContent("Canceling");
    expect(badge).toHaveAttribute("data-variant", "warning");

    const periodLabel = screen.getByTestId("subscription-status-period-label");
    expect(periodLabel).toHaveTextContent(/Cancels/);
  });

  it("renders Active badge when cancelAtPeriodEnd is false", () => {
    render(
      <SubscriptionStatus
        subscription={{
          plan: "pro",
          status: "active",
          currentPeriodEnd: "2026-05-01T00:00:00Z",
          cancelAtPeriodEnd: false,
          nextResetDate: null,
        }}
      />,
    );

    const badge = screen.getByTestId("subscription-status-badge");
    expect(badge).toHaveTextContent("Active");
    expect(badge).toHaveAttribute("data-variant", "default");

    const periodLabel = screen.getByTestId("subscription-status-period-label");
    expect(periodLabel).toHaveTextContent(/Renews/);
  });

  it("renders Free badge for free tier subscription", () => {
    render(
      <SubscriptionStatus
        subscription={{
          plan: "free",
          status: "active",
          currentPeriodEnd: null,
          cancelAtPeriodEnd: false,
          nextResetDate: "2026-05-01T00:00:00Z",
        }}
      />,
    );

    expect(screen.getAllByText("Free")).toHaveLength(2); // h2 plan label + secondary badge
    expect(
      screen.queryByTestId("subscription-status-badge"),
    ).not.toBeInTheDocument();
  });
});
