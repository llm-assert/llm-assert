import { Anchor, Shield, Smile, Braces, Magnet } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

const assertions = [
  {
    icon: Anchor,
    method: "toBeGroundedIn(context)",
    title: "Groundedness",
    description:
      "Catches hallucinations. Verifies the response is grounded in the provided source context.",
    snippet: "await expect(reply).toBeGroundedIn(docs);",
  },
  {
    icon: Shield,
    method: "toBeFreeOfPII()",
    title: "PII Detection",
    description:
      "Detects personal data leaks. Ensures no emails, phone numbers, or sensitive info in output.",
    snippet: "await expect(reply).toBeFreeOfPII();",
  },
  {
    icon: Smile,
    method: "toMatchTone(descriptor)",
    title: "Tone Matching",
    description:
      "Validates tone and sentiment. Check that responses match your brand voice.",
    snippet: "await expect(reply).toMatchTone('professional');",
  },
  {
    icon: Braces,
    method: "toBeFormatCompliant(schema)",
    title: "Format Compliance",
    description:
      "Enforces structured output. Verify JSON responses match your expected schema.",
    snippet:
      "await expect(reply).toBeFormatCompliant('valid JSON with name and email fields');",
  },
  {
    icon: Magnet,
    method: "toSemanticMatch(expected)",
    title: "Semantic Match",
    description:
      "Measures semantic similarity. Compare outputs against expected answers with fuzzy matching.",
    snippet:
      "await expect(reply).toSemanticMatch('Order #123 has been shipped');",
  },
];

export function AssertionsSection() {
  return (
    <section id="features" className="border-t py-20">
      <div className="mx-auto max-w-6xl px-4">
        <h2 className="text-center text-3xl font-bold tracking-tight">
          5 assertion types for LLM outputs
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-muted-foreground">
          Each assertion returns a score, reasoning, and pass/fail — powered by
          LLM judges. All support{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs font-mono">
            .not
          </code>{" "}
          for negation.
        </p>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {assertions.map((a) => (
            <Card key={a.method}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <a.icon className="h-5 w-5 text-primary" />
                  <h3 className="text-base font-semibold">{a.title}</h3>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{a.description}</p>
                <pre className="mt-3 overflow-x-auto rounded bg-muted/50 px-3 py-2 text-xs font-mono">
                  {a.snippet}
                </pre>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
