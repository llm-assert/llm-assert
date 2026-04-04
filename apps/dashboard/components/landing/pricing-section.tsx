import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { PLAN_DISPLAY } from "@/lib/plans.client";

function formatLimit(n: number): string {
  if (n === -1) return "Unlimited";
  return n.toLocaleString();
}

export function PricingSection() {
  return (
    <section id="pricing" className="border-t py-20">
      <div className="mx-auto max-w-6xl px-4">
        <h2 className="text-center text-3xl font-bold tracking-tight">
          Simple, transparent pricing
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-muted-foreground">
          Start free — no credit card required. Scale as your test suite grows.
        </p>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {PLAN_DISPLAY.map((plan) => (
            <Card
              key={plan.name}
              className={cn(plan.name === "pro" && "ring-2 ring-primary")}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">{plan.label}</h3>
                  {plan.name === "pro" && <Badge>Popular</Badge>}
                </div>
                <Badge variant="secondary" className="mt-2 w-fit">
                  Early Access — Free during beta
                </Badge>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>
                    {formatLimit(plan.evaluationLimit)} evaluations / month
                  </li>
                  <li>
                    {formatLimit(plan.projectsLimit)}{" "}
                    {plan.projectsLimit === 1 ? "project" : "projects"}
                  </li>
                  <li>Dashboard analytics</li>
                  <li>All 5 assertion types</li>
                </ul>
              </CardContent>
              <CardFooter>
                <Button
                  className="w-full"
                  variant={plan.name === "free" ? "default" : "outline"}
                  asChild
                >
                  <Link href="/sign-up">
                    {plan.name === "free" ? "Get Started Free" : "Get Started"}
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
