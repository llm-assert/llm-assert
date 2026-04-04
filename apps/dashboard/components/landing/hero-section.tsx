import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CodeBlock } from "./code-block";

const heroCode = `import { test, expect } from '@llmassert/playwright';

test('chatbot stays grounded in docs', async ({ page }) => {
  await page.goto('/chat');
  await page.fill('[name="message"]', 'What is the refund policy?');
  await page.click('button[type="submit"]');

  const reply = await page.textContent('.chat-response');
  const docs = await page.textContent('.source-context');

  // LLM-aware assertions — just like Playwright
  await expect(reply).toBeGroundedIn(docs);
  await expect(reply).toBeFreeOfPII();
  await expect(reply).toMatchTone('helpful and professional');
});`;

export async function HeroSection() {
  return (
    <section id="hero" className="py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-4">
        <div className="grid items-center gap-12 md:grid-cols-5">
          {/* Copy — left 40% */}
          <div className="md:col-span-2">
            <Badge variant="secondary" className="mb-4">
              Playwright Plugin
            </Badge>
            <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
              Assert the unpredictable
            </h1>
            <p className="mt-4 text-lg text-muted-foreground">
              LLM-powered assertions for Playwright. Test your AI outputs with
              matchers you already know.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" asChild>
                <Link href="/sign-up">Get Started Free</Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <a
                  href="https://github.com/llmassert"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View on GitHub
                </a>
              </Button>
            </div>
          </div>

          {/* Code — right 60% */}
          <div className="md:col-span-3">
            <CodeBlock
              code={heroCode}
              label="Example Playwright test using LLMAssert assertions"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
