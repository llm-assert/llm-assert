/* eslint-disable no-console -- CLI script, console is the correct output mechanism */
/**
 * Verify that Stripe products, prices, and metadata match the plan config.
 *
 * Usage:
 *   npx tsx scripts/stripe-verify.ts
 *
 * Requires STRIPE_SECRET_KEY and STRIPE_*_PRICE_ID env vars
 * (loaded from apps/dashboard/.env.local via --env-file or dotenv).
 */

import Stripe from "stripe";

const EXPECTED_PLANS = {
  starter: {
    priceEnvKey: "STRIPE_STARTER_PRICE_ID",
    metadata: { plan: "starter", evaluation_limit: "5000" },
  },
  pro: {
    priceEnvKey: "STRIPE_PRO_PRICE_ID",
    metadata: { plan: "pro", evaluation_limit: "25000" },
  },
  team: {
    priceEnvKey: "STRIPE_TEAM_PRICE_ID",
    metadata: { plan: "team", evaluation_limit: "100000" },
  },
} as const;

type Issue = { level: "ERROR" | "WARN"; message: string };

async function main() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    console.error("ERROR: STRIPE_SECRET_KEY is not set.");
    console.error(
      "Run: npx tsx --env-file=apps/dashboard/.env.local scripts/stripe-verify.ts",
    );
    process.exit(1);
  }

  // Key mode detection (handles both standard sk_ and restricted rk_ keys)
  const isLiveKey =
    secretKey.startsWith("sk_live_") || secretKey.startsWith("rk_live_");
  const keyMode = isLiveKey ? "live" : "test";
  console.log(`Stripe key mode: ${keyMode}`);

  const stripe = new Stripe(secretKey, {
    apiVersion: "2026-03-25.dahlia",
  });
  const issues: Issue[] = [];
  let passed = 0;
  let total = 0;

  for (const [planName, expected] of Object.entries(EXPECTED_PLANS)) {
    const priceId = process.env[expected.priceEnvKey];
    if (!priceId) {
      issues.push({
        level: "ERROR",
        message: `${expected.priceEnvKey} is not set`,
      });
      continue;
    }

    // Retrieve the price and expand product
    total++;
    let price: Stripe.Price;
    try {
      price = await stripe.prices.retrieve(priceId, {
        expand: ["product"],
      });
    } catch (err) {
      issues.push({
        level: "ERROR",
        message: `Failed to retrieve price ${priceId} for ${planName}: ${err}`,
      });
      continue;
    }

    const product = price.product as Stripe.Product;

    // Check livemode consistency
    total++;
    if (price.livemode !== isLiveKey) {
      issues.push({
        level: "ERROR",
        message: `${planName}: price.livemode=${price.livemode} but key is ${keyMode} mode — possible partial cutover`,
      });
    } else {
      passed++;
    }

    // Check product metadata
    for (const [key, expectedValue] of Object.entries(expected.metadata)) {
      total++;
      if (product.metadata[key] !== expectedValue) {
        issues.push({
          level: "ERROR",
          message: `${planName}: product.metadata.${key} = "${product.metadata[key] ?? "(missing)"}", expected "${expectedValue}"`,
        });
      } else {
        passed++;
      }
    }

    // Check price is monthly recurring USD
    total++;
    if (price.recurring?.interval !== "month") {
      issues.push({
        level: "ERROR",
        message: `${planName}: price interval = "${price.recurring?.interval}", expected "month"`,
      });
    } else {
      passed++;
    }

    total++;
    if (price.currency !== "usd") {
      issues.push({
        level: "ERROR",
        message: `${planName}: price currency = "${price.currency}", expected "usd"`,
      });
    } else {
      passed++;
    }

    // Check product is active
    total++;
    if (!product.active) {
      issues.push({
        level: "WARN",
        message: `${planName}: product "${product.name}" is inactive`,
      });
    } else {
      passed++;
    }

    const amount =
      price.unit_amount != null
        ? `$${(price.unit_amount / 100).toFixed(2)}/mo`
        : "(no unit_amount)";
    console.log(`  ${planName}: ${product.name} (${product.id}) — ${amount}`);
  }

  console.log("");

  if (issues.length === 0) {
    console.log(`All checks passed (${passed}/${total}).`);
  } else {
    for (const issue of issues) {
      console.log(`  ${issue.level}: ${issue.message}`);
    }
    console.log(
      `\n${passed}/${total} checks passed, ${issues.length} issue(s).`,
    );
    process.exit(1);
  }
}

main();
