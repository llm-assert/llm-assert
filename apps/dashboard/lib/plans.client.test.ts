import { describe, it, expect, vi } from "vitest";
import {
  PLAN_DISPLAY,
  PLAN_NAMES,
  getPlanDisplay,
  type PlanName,
} from "./plans.client";

// Mock server-only so we can import plans.ts (server module) in unit tests
vi.mock("server-only", () => ({}));
import { PLANS } from "./plans";

describe("PLAN_DISPLAY", () => {
  it("has exactly 4 plans in correct order", () => {
    expect(PLAN_DISPLAY).toHaveLength(4);
    expect(PLAN_DISPLAY.map((p) => p.name)).toEqual([
      "free",
      "starter",
      "pro",
      "team",
    ]);
  });

  it("each plan name matches PLAN_NAMES", () => {
    for (const plan of PLAN_DISPLAY) {
      expect(PLAN_NAMES).toContain(plan.name);
    }
  });

  it("free plan has null displayPrice", () => {
    const free = PLAN_DISPLAY.find((p) => p.name === "free")!;
    expect(free.displayPrice).toBeNull();
  });

  it("paid plans have non-empty displayPrice strings", () => {
    const paidPlans = PLAN_DISPLAY.filter((p) => p.name !== "free");
    for (const plan of paidPlans) {
      expect(plan.displayPrice).toBeTruthy();
      expect(typeof plan.displayPrice).toBe("string");
    }
  });

  it("each plan has non-empty features array", () => {
    for (const plan of PLAN_DISPLAY) {
      expect(plan.features.length).toBeGreaterThan(0);
      for (const feature of plan.features) {
        expect(feature.label).toBeTruthy();
        expect(typeof feature.included).toBe("boolean");
      }
    }
  });

  it("evaluation limits match server-side PLANS config (sync guard)", () => {
    for (const display of PLAN_DISPLAY) {
      const server = PLANS[display.name];
      expect(display.evaluationLimit).toBe(server.evaluationLimit);
    }
  });
});

describe("getPlanDisplay", () => {
  it("returns correct plan for 'pro'", () => {
    const pro = getPlanDisplay("pro");
    expect(pro.name).toBe("pro");
    expect(pro.evaluationLimit).toBe(25_000);
    expect(pro.projectsLimit).toBe(10);
    expect(pro.displayPrice).toBe("$79");
  });

  it("falls back to free plan for unknown name", () => {
    const fallback = getPlanDisplay("unknown" as PlanName);
    expect(fallback.name).toBe("free");
    expect(fallback.evaluationLimit).toBe(100);
  });
});
