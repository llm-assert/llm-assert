/**
 * Display-safe plan constants — no serverEnv dependency.
 * Safe to import in Client Components.
 *
 * SECURITY: This module contains ONLY marketing/display data.
 * Stripe price IDs, API keys, and webhook secrets stay in plans.ts and env.server.ts.
 */

export const PLAN_NAMES = ["free", "starter", "pro", "team"] as const;

export type PlanName = (typeof PLAN_NAMES)[number];

export type PlanFeature = {
  label: string;
  included: boolean;
};

export type PlanDisplay = {
  name: PlanName;
  label: string;
  displayPrice: string | null;
  evaluationLimit: number;
  projectsLimit: number;
  features: PlanFeature[];
};

const SHARED_FEATURES: PlanFeature[] = [
  { label: "Dashboard analytics", included: true },
  { label: "All 5 assertion types", included: true },
  { label: "CI integration", included: true },
  { label: "Custom thresholds", included: true },
  { label: "Cost tracking", included: true },
];

export const PLAN_DISPLAY: PlanDisplay[] = [
  {
    name: "free",
    label: "Free",
    displayPrice: null,
    evaluationLimit: 100,
    projectsLimit: 1,
    features: SHARED_FEATURES,
  },
  {
    name: "starter",
    label: "Starter",
    displayPrice: "$29",
    evaluationLimit: 5_000,
    projectsLimit: 3,
    features: SHARED_FEATURES,
  },
  {
    name: "pro",
    label: "Pro",
    displayPrice: "$79",
    evaluationLimit: 25_000,
    projectsLimit: 10,
    features: SHARED_FEATURES,
  },
  {
    name: "team",
    label: "Team",
    displayPrice: "$199",
    evaluationLimit: 100_000,
    projectsLimit: -1, // Unlimited — use -1 for JSON serialization safety
    features: SHARED_FEATURES,
  },
];

export function getPlanDisplay(name: PlanName): PlanDisplay {
  return PLAN_DISPLAY.find((p) => p.name === name) ?? PLAN_DISPLAY[0];
}
