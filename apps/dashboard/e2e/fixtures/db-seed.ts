import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { generateApiKey } from "../../lib/api-keys";
import { buildIngestPayload } from "../../test/factories";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required env var: ${name}. See apps/dashboard/.env.example`,
    );
  }
  return value;
}

function getAdmin(): SupabaseClient {
  return createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export interface SeededTestData {
  admin: SupabaseClient;
  userId: string;
  userEmail: string;
  projectId: string;
  projectSlug: string;
  apiKeyId: string;
  rawApiKey: string;
}

/**
 * Seeds a complete test environment: user, project, and active API key.
 * The free-tier signup trigger auto-creates an active subscription.
 */
export async function seedTestData(): Promise<SeededTestData> {
  const admin = getAdmin();
  const testId = randomUUID().slice(0, 8);
  const userEmail = `test-revocation-${testId}@llmassert.local`;
  const projectSlug = `test-revocation-${testId}`;

  // 1. Create user — free-tier trigger auto-creates subscription
  const { data: userData, error: userError } =
    await admin.auth.admin.createUser({
      email: userEmail,
      password: "test-password-not-used",
      email_confirm: true,
    });
  if (userError || !userData.user) {
    throw new Error(`Failed to create test user: ${userError?.message}`);
  }
  const userId = userData.user.id;

  // 2. Create project
  const { data: project, error: projectError } = await admin
    .from("projects")
    .insert({
      name: `Revocation Test ${testId}`,
      slug: projectSlug,
      user_id: userId,
    })
    .select("id")
    .single();
  if (projectError || !project) {
    throw new Error(`Failed to create project: ${projectError?.message}`);
  }

  // 3. Generate and insert API key
  const key = generateApiKey();
  const { data: apiKey, error: keyError } = await admin
    .from("api_keys")
    .insert({
      user_id: userId,
      project_id: project.id,
      key_hash: key.hash,
      key_prefix: key.prefix,
      label: `revocation-test-${testId}`,
    })
    .select("id")
    .single();
  if (keyError || !apiKey) {
    throw new Error(`Failed to create API key: ${keyError?.message}`);
  }

  return {
    admin,
    userId,
    userEmail,
    projectId: project.id,
    projectSlug,
    apiKeyId: apiKey.id,
    rawApiKey: key.raw,
  };
}

/**
 * Cleans up all test data in reverse FK order.
 * Logs errors but does not throw — best-effort cleanup so afterAll never blocks.
 */
export async function cleanupTestData(
  admin: SupabaseClient,
  userId: string,
): Promise<void> {
  const tables = [
    "evaluations",
    "test_runs",
    "api_keys",
    "projects",
    "subscriptions",
  ] as const;

  for (const table of tables) {
    const { error } = await admin.from(table).delete().eq("user_id", userId);
    if (error) {
      console.warn(`[cleanup] Failed to delete from ${table}: ${error.message}`);
    }
  }

  const { error: userError } = await admin.auth.admin.deleteUser(userId);
  if (userError) {
    console.warn(`[cleanup] Failed to delete user: ${userError.message}`);
  }
}

/**
 * Builds a valid ingest payload with the given project slug.
 */
export function buildTestIngestPayload(projectSlug: string) {
  return buildIngestPayload({ project_slug: projectSlug });
}
