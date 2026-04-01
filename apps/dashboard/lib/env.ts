function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        `Set it in .env.local or via the Vercel dashboard.`,
    );
  }
  return value;
}

function requiredUrl(name: string, value: string | undefined): string {
  const v = required(name, value);
  try {
    new URL(v);
  } catch {
    throw new Error(
      `Environment variable ${name} is not a valid URL: "${v}". ` +
        `Expected a full URL like "https://example.supabase.co".`,
    );
  }
  return v;
}

export const publicEnv = {
  NEXT_PUBLIC_SUPABASE_URL: requiredUrl(
    "NEXT_PUBLIC_SUPABASE_URL",
    process.env.NEXT_PUBLIC_SUPABASE_URL,
  ),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: required(
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  ),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: required(
    "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  ),
  /** Set explicitly for production. Falls back to VERCEL_URL for preview, localhost for dev. */
  NEXT_PUBLIC_APP_URL:
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000"),
} as const;
