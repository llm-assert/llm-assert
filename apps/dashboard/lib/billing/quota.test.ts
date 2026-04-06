import { describe, expect, it } from "vitest";
import { getBillingAlertState } from "./quota";
import type { SubscriptionRow } from "@/lib/supabase/queries/subscription";

function makeSub(overrides: Partial<SubscriptionRow> = {}): SubscriptionRow {
  return {
    status: "active",
    plan: "pro",
    evaluations_used: 0,
    evaluation_limit: 25_000,
    current_period_end: "2026-05-01T00:00:00Z",
    ...overrides,
  };
}

describe("getBillingAlertState", () => {
  it("returns none for null subscription", () => {
    expect(getBillingAlertState(null)).toEqual({ state: "none" });
  });

  it("returns past_due regardless of quota", () => {
    const sub = makeSub({
      status: "past_due",
      evaluations_used: 100,
      evaluation_limit: 25_000,
    });
    expect(getBillingAlertState(sub)).toEqual({ state: "past_due" });
  });

  it("returns past_due even when quota is exceeded", () => {
    const sub = makeSub({
      status: "past_due",
      evaluations_used: 30_000,
      evaluation_limit: 25_000,
    });
    expect(getBillingAlertState(sub)).toEqual({ state: "past_due" });
  });

  it("returns quota_exceeded at 100%", () => {
    const sub = makeSub({
      evaluations_used: 25_000,
      evaluation_limit: 25_000,
    });
    expect(getBillingAlertState(sub)).toEqual({
      state: "quota_exceeded",
      used: 25_000,
      limit: 25_000,
    });
  });

  it("returns quota_exceeded when over limit", () => {
    const sub = makeSub({
      evaluations_used: 26_000,
      evaluation_limit: 25_000,
    });
    expect(getBillingAlertState(sub)).toEqual({
      state: "quota_exceeded",
      used: 26_000,
      limit: 25_000,
    });
  });

  it("returns quota_warning for pro plan at 90%", () => {
    const sub = makeSub({
      plan: "pro",
      evaluations_used: 22_500,
      evaluation_limit: 25_000,
    });
    expect(getBillingAlertState(sub)).toEqual({
      state: "quota_warning",
      used: 22_500,
      limit: 25_000,
      remaining: 2_500,
    });
  });

  it("returns none for pro plan at 89%", () => {
    const sub = makeSub({
      plan: "pro",
      evaluations_used: 22_250,
      evaluation_limit: 25_000,
    });
    expect(getBillingAlertState(sub)).toEqual({ state: "none" });
  });

  it("returns quota_warning for free plan at 95%", () => {
    const sub = makeSub({
      plan: "free",
      evaluations_used: 95,
      evaluation_limit: 100,
    });
    expect(getBillingAlertState(sub)).toEqual({
      state: "quota_warning",
      used: 95,
      limit: 100,
      remaining: 5,
    });
  });

  it("returns none for free plan at 90%", () => {
    const sub = makeSub({
      plan: "free",
      evaluations_used: 90,
      evaluation_limit: 100,
    });
    expect(getBillingAlertState(sub)).toEqual({ state: "none" });
  });

  it("returns none for free plan at 80% (sidebar-only territory)", () => {
    const sub = makeSub({
      plan: "free",
      evaluations_used: 80,
      evaluation_limit: 100,
    });
    expect(getBillingAlertState(sub)).toEqual({ state: "none" });
  });

  it("returns none when evaluation_limit is 0 (division-by-zero guard)", () => {
    const sub = makeSub({
      evaluations_used: 0,
      evaluation_limit: 0,
    });
    expect(getBillingAlertState(sub)).toEqual({ state: "none" });
  });

  it("uses free threshold for unknown plan names", () => {
    const sub = makeSub({
      plan: "enterprise" as string,
      evaluations_used: 94,
      evaluation_limit: 100,
    });
    // 94% < 95% (free threshold fallback) → none
    expect(getBillingAlertState(sub)).toEqual({ state: "none" });
  });

  it("returns quota_warning for starter at 95%", () => {
    const sub = makeSub({
      plan: "starter",
      evaluations_used: 4_750,
      evaluation_limit: 5_000,
    });
    expect(getBillingAlertState(sub)).toEqual({
      state: "quota_warning",
      used: 4_750,
      limit: 5_000,
      remaining: 250,
    });
  });

  it("returns none for starter at 94%", () => {
    const sub = makeSub({
      plan: "starter",
      evaluations_used: 4_700,
      evaluation_limit: 5_000,
    });
    expect(getBillingAlertState(sub)).toEqual({ state: "none" });
  });

  it("returns quota_warning for team at 90%", () => {
    const sub = makeSub({
      plan: "team",
      evaluations_used: 90_000,
      evaluation_limit: 100_000,
    });
    expect(getBillingAlertState(sub)).toEqual({
      state: "quota_warning",
      used: 90_000,
      limit: 100_000,
      remaining: 10_000,
    });
  });

  it("returns none for active subscription well below threshold", () => {
    const sub = makeSub({
      evaluations_used: 1_000,
      evaluation_limit: 25_000,
    });
    expect(getBillingAlertState(sub)).toEqual({ state: "none" });
  });

  it("returns none for canceled subscription (not past_due)", () => {
    const sub = makeSub({
      status: "canceled",
      evaluations_used: 0,
      evaluation_limit: 25_000,
    });
    expect(getBillingAlertState(sub)).toEqual({ state: "none" });
  });
});
