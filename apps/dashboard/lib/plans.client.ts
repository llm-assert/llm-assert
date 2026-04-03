/**
 * Display-safe plan constants — no serverEnv dependency.
 * Safe to import in Client Components.
 */

export const PLAN_NAMES = ["free", "starter", "pro", "team"] as const;

export type PlanName = (typeof PLAN_NAMES)[number];

export type PlanDisplay = {
  name: PlanName;
  label: string;
  evaluationLimit: number;
  projectsLimit: number;
};

export const PLAN_DISPLAY: PlanDisplay[] = [
  { name: "free", label: "Free", evaluationLimit: 100, projectsLimit: 1 },
  {
    name: "starter",
    label: "Starter",
    evaluationLimit: 5_000,
    projectsLimit: 3,
  },
  { name: "pro", label: "Pro", evaluationLimit: 25_000, projectsLimit: 10 },
  {
    name: "team",
    label: "Team",
    evaluationLimit: 100_000,
    projectsLimit: -1, // Unlimited — use -1 for JSON serialization safety
  },
];

export function getPlanDisplay(name: PlanName): PlanDisplay {
  return PLAN_DISPLAY.find((p) => p.name === name) ?? PLAN_DISPLAY[0];
}
