import type { Metadata } from "next";
import { HeroSection } from "@/components/landing/hero-section";
import { HowItWorksSection } from "@/components/landing/how-it-works-section";
import { AssertionsSection } from "@/components/landing/assertions-section";
import { PricingSection } from "@/components/landing/pricing-section";
import { CtaSection } from "@/components/landing/cta-section";

export const metadata: Metadata = {
  title: "LLMAssert — LLM-Powered Assertions for Playwright",
  description:
    "Ship AI-tested software with confidence. Groundedness, PII detection, tone matching, format compliance, and semantic matching — powered by LLM judges, built on Playwright.",
};

export default function LandingPage() {
  return (
    <>
      <HeroSection />
      <HowItWorksSection />
      <AssertionsSection />
      <PricingSection />
      <CtaSection />
    </>
  );
}
