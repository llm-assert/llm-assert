import Link from "next/link";
import { Button } from "@/components/ui/button";

export function CtaSection() {
  return (
    <section id="cta" className="border-t py-20">
      <div className="mx-auto max-w-2xl px-4 text-center">
        <h2 className="text-3xl font-bold tracking-tight">
          Start testing your LLM outputs today
        </h2>
        <p className="mt-4 text-lg text-muted-foreground">
          Free tier, no credit card required. Add LLM assertions to your
          Playwright tests in minutes.
        </p>
        <Button size="lg" className="mt-8" asChild>
          <Link href="/sign-up">Get Started Free</Link>
        </Button>
      </div>
    </section>
  );
}
