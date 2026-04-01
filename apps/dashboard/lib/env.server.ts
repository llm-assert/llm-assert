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

const serviceRoleKey = required(
  "SUPABASE_SERVICE_ROLE_KEY",
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

if (serviceRoleKey === supabasePublishableKey) {
  throw new Error(
    "SUPABASE_SERVICE_ROLE_KEY is identical to NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. " +
      "The service role key must be a different key that bypasses RLS. " +
      "Using the anon key as service_role causes silent write failures in ingest and webhook routes.",
  );
}

export const serverEnv = {
  SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
  STRIPE_SECRET_KEY: requiredInProduction(
    "STRIPE_SECRET_KEY",
    process.env.STRIPE_SECRET_KEY,
  ),
  STRIPE_WEBHOOK_SECRET: requiredInProduction(
    "STRIPE_WEBHOOK_SECRET",
    process.env.STRIPE_WEBHOOK_SECRET,
  ),
  STRIPE_STARTER_PRICE_ID: requiredInProduction(
    "STRIPE_STARTER_PRICE_ID",
    process.env.STRIPE_STARTER_PRICE_ID,
  ),
  STRIPE_PRO_PRICE_ID: requiredInProduction(
    "STRIPE_PRO_PRICE_ID",
    process.env.STRIPE_PRO_PRICE_ID,
  ),
  STRIPE_TEAM_PRICE_ID: requiredInProduction(
    "STRIPE_TEAM_PRICE_ID",
    process.env.STRIPE_TEAM_PRICE_ID,
  ),
  CRON_SECRET: requiredInProduction("CRON_SECRET", process.env.CRON_SECRET),
} as const;
