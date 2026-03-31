export const PLAN_NAMES = ["free", "starter", "pro", "team"] as const;

export type PlanName = (typeof PLAN_NAMES)[number];

export type PlanConfig = {
  name: PlanName;
  label: string;
  evaluationLimit: number;
  projectsLimit: number;
  priceEnvVar: string | null;
};

export const PLANS: Record<PlanName, PlanConfig> = {
  free: {
    name: "free",
    label: "Free",
    evaluationLimit: 100,
    projectsLimit: 1,
    priceEnvVar: null,
  },
  starter: {
    name: "starter",
    label: "Starter",
    evaluationLimit: 5_000,
    projectsLimit: 3,
    priceEnvVar: "STRIPE_STARTER_PRICE_ID",
  },
  pro: {
    name: "pro",
    label: "Pro",
    evaluationLimit: 25_000,
    projectsLimit: 10,
    priceEnvVar: "STRIPE_PRO_PRICE_ID",
  },
  team: {
    name: "team",
    label: "Team",
    evaluationLimit: 100_000,
    projectsLimit: Infinity,
    priceEnvVar: "STRIPE_TEAM_PRICE_ID",
  },
};

/** Resolve a Stripe price ID to a plan config, or null if not found. */
export function planFromPriceId(priceId: string): PlanConfig | null {
  for (const plan of Object.values(PLANS)) {
    if (plan.priceEnvVar && process.env[plan.priceEnvVar] === priceId) {
      return plan;
    }
  }
  return null;
}
