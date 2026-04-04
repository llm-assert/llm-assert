import { Download, Code, BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

const steps = [
  {
    icon: Download,
    title: "Install",
    description:
      "Add @llmassert/playwright to your project. One package, zero config.",
    snippet: "pnpm add -D @llmassert/playwright",
  },
  {
    icon: Code,
    title: "Write",
    description:
      "Swap your import and add LLM assertions alongside your existing Playwright tests.",
    snippet: "await expect(reply).toBeGroundedIn(docs);",
  },
  {
    icon: BarChart3,
    title: "Run & See",
    description:
      "Run your tests with npx playwright test. Scores and trends appear on the dashboard.",
    snippet: "npx playwright test",
  },
];

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="border-t py-20">
      <div className="mx-auto max-w-6xl px-4">
        <h2 className="text-center text-3xl font-bold tracking-tight">
          How it works
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-muted-foreground">
          Three steps to start testing your LLM outputs.
        </p>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {steps.map((step, i) => (
            <Card key={step.title}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
                    {i + 1}
                  </div>
                  <h3 className="text-lg font-semibold">{step.title}</h3>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {step.description}
                </p>
                <pre className="mt-3 overflow-x-auto rounded bg-muted/50 px-3 py-2 text-xs font-mono">
                  {step.snippet}
                </pre>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
