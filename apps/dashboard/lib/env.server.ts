import "server-only";

const env = process.env.VERCEL_ENV ?? "development";

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        `Set it in .env.local or via the Vercel dashboard.`,
    );
  }
  return value;
}

function requiredInProduction(
  name: string,
  value: string | undefined,
): string | undefined {
  if (!value && env === "production") {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        `This variable is required in production. ` +
        `Set it in the Vercel dashboard (production target).`,
    );
  }
  return value;
}

const supabasePublishableKey = required(
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
);

if (supabasePublishableKey.includes("service_role")) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY contains 'service_role'. " +
      "This is the service role key — it must NOT be used as the publishable key. " +
      "Use the anon/publishable key instead.",
  );
}

export const serverEnv = {
  SUPABASE_SERVICE_ROLE_KEY: required(
    "SUPABASE_SERVICE_ROLE_KEY",
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  ),
  STRIPE_SECRET_KEY: requiredInProduction(
    "STRIPE_SECRET_KEY",
    process.env.STRIPE_SECRET_KEY,
  ),
  STRIPE_WEBHOOK_SECRET: requiredInProduction(
    "STRIPE_WEBHOOK_SECRET",
    process.env.STRIPE_WEBHOOK_SECRET,
  ),
  STRIPE_STARTER_PRICE_ID: required(
    "STRIPE_STARTER_PRICE_ID",
    process.env.STRIPE_STARTER_PRICE_ID,
  ),
  STRIPE_PRO_PRICE_ID: required(
    "STRIPE_PRO_PRICE_ID",
    process.env.STRIPE_PRO_PRICE_ID,
  ),
  STRIPE_TEAM_PRICE_ID: required(
    "STRIPE_TEAM_PRICE_ID",
    process.env.STRIPE_TEAM_PRICE_ID,
  ),
  CRON_SECRET: requiredInProduction("CRON_SECRET", process.env.CRON_SECRET),
} as const;
