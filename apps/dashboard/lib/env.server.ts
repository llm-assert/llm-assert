import "server-only";

// ---------------------------------------------------------------------------
// Server-only environment variables — lazy validation
// ---------------------------------------------------------------------------
//
// Validation runs on first property access, NOT at import time. This is
// critical because Next.js imports route modules during `next build`
// ("Collecting page data") even when the route is force-dynamic. Eager
// validation at module scope causes build failures in CI where server
// secrets (SUPABASE_SERVICE_ROLE_KEY, etc.) are not available.

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        `Set it in .env.local or via the Vercel dashboard.`,
    );
  }
  return value;
}

function requiredInProduction(name: string): string | undefined {
  const value = process.env[name];
  if (!value && process.env.VERCEL_ENV === "production") {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        `This variable is required in production. ` +
        `Set it in the Vercel dashboard (production target).`,
    );
  }
  return value;
}

// Lazy proxy: each property is validated on first access and cached.
const cache = new Map<string, string | undefined>();

function lazy(name: string, validate: (name: string) => string | undefined) {
  return () => {
    if (cache.has(name)) return cache.get(name)!;
    const value = validate(name);
    cache.set(name, value);
    return value;
  };
}

const getServiceRoleKey = lazy("SUPABASE_SERVICE_ROLE_KEY", required);
const getPublishableKey = lazy(
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  required,
);

export const serverEnv = {
  get SUPABASE_SERVICE_ROLE_KEY(): string {
    const key = getServiceRoleKey() as string;
    const pubKey = getPublishableKey() as string;

    if (pubKey.includes("service_role")) {
      throw new Error(
        "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY contains 'service_role'. " +
          "This is the service role key — it must NOT be used as the publishable key. " +
          "Use the anon/publishable key instead.",
      );
    }

    if (key === pubKey) {
      throw new Error(
        "SUPABASE_SERVICE_ROLE_KEY is identical to NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. " +
          "The service role key must be a different key that bypasses RLS. " +
          "Using the anon key as service_role causes silent write failures in ingest and webhook routes.",
      );
    }

    return key;
  },
  get STRIPE_SECRET_KEY(): string | undefined {
    return requiredInProduction("STRIPE_SECRET_KEY");
  },
  get STRIPE_WEBHOOK_SECRET(): string | undefined {
    return requiredInProduction("STRIPE_WEBHOOK_SECRET");
  },
  get STRIPE_STARTER_PRICE_ID(): string | undefined {
    return requiredInProduction("STRIPE_STARTER_PRICE_ID");
  },
  get STRIPE_PRO_PRICE_ID(): string | undefined {
    return requiredInProduction("STRIPE_PRO_PRICE_ID");
  },
  get STRIPE_TEAM_PRICE_ID(): string | undefined {
    return requiredInProduction("STRIPE_TEAM_PRICE_ID");
  },
  get CRON_SECRET(): string | undefined {
    return requiredInProduction("CRON_SECRET");
  },
} as const;
