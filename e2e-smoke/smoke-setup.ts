import { createClient } from "@supabase/supabase-js";
import { createHash, randomBytes } from "node:crypto";
import { writeFileSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";

const STATE_PATH = path.resolve(__dirname, ".smoke-state.json");

export interface SmokeState {
  projectId: string;
  projectSlug: string;
  apiKeyRaw: string;
  apiKeyId: string;
  userId: string;
}

export default async function smokeSetup() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const testEmail = process.env.E2E_TEST_EMAIL;

  if (!supabaseUrl || !serviceRoleKey || !testEmail) {
    throw new Error(
      "Missing required env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, E2E_TEST_EMAIL",
    );
  }

  // Check for existing state — reuse if project still exists
  if (existsSync(STATE_PATH)) {
    try {
      const existing: SmokeState = JSON.parse(
        readFileSync(STATE_PATH, "utf-8"),
      );
      const db = createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { data } = await db
        .from("projects")
        .select("id")
        .eq("id", existing.projectId)
        .single();
      if (data) {
        console.info(
          `[smoke-setup] Reusing existing project: ${existing.projectSlug}`,
        );
        return;
      }
    } catch {
      // State file invalid or project gone — recreate
    }
  }

  const db = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Look up the test user — create if it doesn't exist yet
  const testPassword = process.env.E2E_TEST_PASSWORD;
  if (!testPassword) {
    throw new Error("Missing required env var: E2E_TEST_PASSWORD");
  }

  const { data: listData } = await db.auth.admin.listUsers();
  let testUser = listData?.users.find((u) => u.email === testEmail);

  if (!testUser) {
    const { data: created, error: createError } =
      await db.auth.admin.createUser({
        email: testEmail,
        password: testPassword,
        email_confirm: true,
      });
    if (createError || !created.user) {
      throw new Error(`Failed to create test user: ${createError?.message}`);
    }
    testUser = created.user;
    console.info(`[smoke-setup] Created test user: ${testEmail}`);
  }

  // Ensure test user has an active subscription (required by ingest quota check)
  const { data: existingSub } = await db
    .from("subscriptions")
    .select("id")
    .eq("user_id", testUser.id)
    .eq("status", "active")
    .maybeSingle();

  if (!existingSub) {
    const { error: subError } = await db.from("subscriptions").insert({
      user_id: testUser.id,
      stripe_customer_id: `cus_smoke_${Date.now()}`,
      stripe_subscription_id: `sub_smoke_${Date.now()}`,
      plan: "free",
      status: "active",
      evaluation_limit: 1000,
      evaluations_used: 0,
    });
    if (subError) {
      throw new Error(
        `Failed to create smoke test subscription: ${subError.message}`,
      );
    }
    console.info("[smoke-setup] Created test subscription");
  }

  // Create a test project with unique slug
  const slug = `smoke-e2e-${Date.now()}`;
  const { data: project, error: projectError } = await db
    .from("projects")
    .insert({
      user_id: testUser.id,
      name: "Smoke Test Project",
      slug,
    })
    .select("id")
    .single();

  if (projectError || !project) {
    throw new Error(
      `Failed to create smoke test project: ${projectError?.message}`,
    );
  }

  // Generate API key
  const rawKey = `lma_smoke_${randomBytes(24).toString("hex")}`;
  const keyHash = createHash("sha256").update(rawKey).digest("hex");
  const keyPrefix = rawKey.slice(0, 12);

  const { data: apiKey, error: keyError } = await db
    .from("api_keys")
    .insert({
      project_id: project.id,
      user_id: testUser.id,
      key_hash: keyHash,
      key_prefix: keyPrefix,
      label: "smoke-test",
    })
    .select("id")
    .single();

  if (keyError || !apiKey) {
    throw new Error(
      `Failed to create smoke test API key: ${keyError?.message}`,
    );
  }

  const state: SmokeState = {
    projectId: project.id,
    projectSlug: slug,
    apiKeyRaw: rawKey,
    apiKeyId: apiKey.id,
    userId: testUser.id,
  };

  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
  console.info(
    `[smoke-setup] Created project: ${slug}, API key: ${keyPrefix}…`,
  );
}
