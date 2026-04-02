import { serverEnv } from "@/lib/env.server";

export const PLAN_NAMES = ["free", "starter", "pro", "team"] as const;

export type PlanName = (typeof PLAN_NAMES)[number];

export type PlanConfig = {
  name: PlanName;
  label: string;
  evaluationLimit: number;
  projectsLimit: number;
  priceId: string | null;
};

export const PLANS: Record<PlanName, PlanConfig> = {
  free: {
    name: "free",
    label: "Free",
    evaluationLimit: 100,
    projectsLimit: 1,
    priceId: null,
  },
  starter: {
    name: "starter",
    label: "Starter",
    evaluationLimit: 5_000,
    projectsLimit: 3,
    priceId: serverEnv.STRIPE_STARTER_PRICE_ID ?? null,
  },
  pro: {
    name: "pro",
    label: "Pro",
    evaluationLimit: 25_000,
    projectsLimit: 10,
    priceId: serverEnv.STRIPE_PRO_PRICE_ID ?? null,
  },
  team: {
    name: "team",
    label: "Team",
    evaluationLimit: 100_000,
    projectsLimit: Infinity,
    priceId: serverEnv.STRIPE_TEAM_PRICE_ID ?? null,
  },
};

/** Resolve a Stripe price ID to a plan config, or null if not found. */
export function planFromPriceId(priceId: string): PlanConfig | null {
  for (const plan of Object.values(PLANS)) {
    if (plan.priceId && plan.priceId === priceId) {
      return plan;
    }
  }
  return null;
}
