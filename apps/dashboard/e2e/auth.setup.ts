import { test as setup, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// Playwright resolves relative paths from the config file's directory.
// This must match the storageState path in playwright.config.ts.
const authFile = "e2e/.auth/user.json";

const E2E_TEST_EMAIL = process.env.E2E_TEST_EMAIL;
const E2E_TEST_PASSWORD = process.env.E2E_TEST_PASSWORD;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function requireEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing required env var: ${name}. See apps/dashboard/.env.example`,
    );
  }
  return value;
}

setup("create test user and authenticate", async ({ page }) => {
  const email = requireEnv("E2E_TEST_EMAIL", E2E_TEST_EMAIL);
  const password = requireEnv("E2E_TEST_PASSWORD", E2E_TEST_PASSWORD);
  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL", SUPABASE_URL);
  const serviceRoleKey = requireEnv(
    "SUPABASE_SERVICE_ROLE_KEY",
    SUPABASE_SERVICE_ROLE_KEY,
  );

  // Use raw createClient (NOT createServerClient from @supabase/ssr) —
  // the SSR client threads cookies into the Authorization header, which
  // overrides the service_role key and re-enables RLS.
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // Upsert test user — idempotent across runs
  const { data: listData } = await admin.auth.admin.listUsers();
  const existing = listData?.users.find((u) => u.email === email);

  if (!existing) {
    const { error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error) throw new Error(`Failed to create test user: ${error.message}`);
  }

  // Sign in via the browser to capture cookie-based session
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();

  // Wait for redirect to dashboard root
  await page.waitForURL("/dashboard");
  await expect(page.locator("body")).not.toContainText("Sign in to LLMAssert");

  // Save auth state for reuse by authenticated test projects
  await page.context().storageState({ path: authFile });
});
