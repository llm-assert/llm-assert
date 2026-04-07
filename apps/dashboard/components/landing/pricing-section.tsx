import Link from "next/link";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { PLAN_DISPLAY, getPlanDisplay } from "@/lib/plans.client";

function formatLimit(n: number): string {
  if (n === -1) return "Unlimited";
  return n.toLocaleString();
}

export function PricingSection() {
  const freePlan = getPlanDisplay("free");
  const paidPlans = PLAN_DISPLAY.filter((p) => p.name !== "free");

  return (
    <section id="pricing" className="border-t py-20">
      <div className="mx-auto max-w-5xl px-4">
        <h2 className="text-center text-3xl font-bold tracking-tight">
          Simple, transparent pricing
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-muted-foreground">
          Start free — no credit card required. Scale as your test suite grows.
        </p>

        {/* Free tier callout */}
        <div
          className="mx-auto mt-10 flex max-w-2xl flex-col items-center gap-4 rounded-lg border bg-muted/50 p-6 sm:flex-row sm:justify-between"
          data-testid="pricing-section-free-callout"
        >
          <div className="text-center sm:text-left">
            <p className="font-semibold">{freePlan.label}</p>
            <p className="text-sm text-muted-foreground">
              {formatLimit(freePlan.evaluationLimit)} evaluations / month
              {" · "}
              {freePlan.projectsLimit} project · No credit card required
            </p>
          </div>
          <Button asChild>
            <Link href="/sign-up">Get Started Free</Link>
          </Button>
        </div>

        {/* Paid tier grid */}
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {paidPlans.map((plan) => {
            const headingId = `pricing-${plan.name}`;
            const isPro = plan.name === "pro";

            return (
              <Card
                key={plan.name}
                className={cn("flex flex-col", isPro && "ring-2 ring-primary")}
                aria-labelledby={headingId}
                data-testid={`pricing-section-plan-card-${plan.name}`}
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <h3 id={headingId} className="text-lg font-semibold">
                      {plan.label}
                    </h3>
                    {isPro && <Badge>Popular</Badge>}
                  </div>
                  <div
                    className="mt-3"
                    data-testid={`pricing-section-price-${plan.name}`}
                  >
                    <span className="text-4xl font-bold">
                      {plan.displayPrice}
                    </span>
                    <span className="text-muted-foreground">/month</span>
                  </div>
                </CardHeader>
                <CardContent className="flex-1">
                  <ul className="space-y-2 text-sm">
                    <li className="font-medium">
                      {formatLimit(plan.evaluationLimit)} evaluations / month
                    </li>
                    <li className="font-medium">
                      {formatLimit(plan.projectsLimit)}{" "}
                      {plan.projectsLimit === 1 ? "project" : "projects"}
                    </li>
                  </ul>
                  <ul className="mt-4 space-y-2 text-sm">
                    {plan.features.map((feature) => (
                      <li
                        key={feature.label}
                        className={cn(
                          "flex items-center gap-2",
                          !feature.included && "text-muted-foreground",
                        )}
                      >
                        {feature.included ? (
                          <Check
                            className="h-4 w-4 shrink-0 text-green-600"
                            aria-hidden="true"
                          />
                        ) : (
                          <X
                            className="h-4 w-4 shrink-0 text-muted-foreground/50"
                            aria-hidden="true"
                          />
                        )}
                        <span className="sr-only">
                          {feature.included ? "Included: " : "Not included: "}
                        </span>
                        {feature.label}
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter>
                  <Button
                    className="w-full"
                    variant={isPro ? "default" : "outline"}
                    asChild
                  >
                    <Link
                      href="/sign-up"
                      aria-label={`Get Started — ${plan.label} plan`}
                      data-testid={`pricing-section-cta-${plan.name}`}
                    >
                      Get Started
                    </Link>
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
