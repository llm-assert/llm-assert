import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

function getAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function getTestUserId(): Promise<string> {
  const admin = getAdmin();
  const email = process.env.E2E_TEST_EMAIL!;
  const { data } = await admin.auth.admin.listUsers();
  const user = data?.users.find((u) => u.email === email);
  if (!user) throw new Error("Test user not found");
  return user.id;
}

async function cleanupUserData(userId: string) {
  const admin = getAdmin();
  // Delete projects — FK cascades handle api_keys, test_runs, evaluations, thresholds
  await admin.from("projects").delete().eq("user_id", userId);
  // Reset onboarding dismissed
  await admin.auth.admin.updateUserById(userId, {
    user_metadata: { onboarding_dismissed: null },
  });
}

async function seedProject(userId: string): Promise<string> {
  const admin = getAdmin();
  const { data, error } = await admin
    .from("projects")
    .insert({
      user_id: userId,
      name: "E2E Onboarding Test",
      slug: `e2e-onboard-${Date.now()}`,
    })
    .select("id")
    .single();
  if (error) throw new Error(`Failed to seed project: ${error.message}`);
  return data.id;
}

async function seedTestRun(projectId: string, userId: string) {
  const admin = getAdmin();
  const { error } = await admin.from("test_runs").insert({
    project_id: projectId,
    user_id: userId,
    started_at: new Date().toISOString(),
    finished_at: new Date().toISOString(),
    total_evaluations: 1,
    passed: 1,
    failed: 0,
    inconclusive: 0,
  });
  if (error) throw new Error(`Failed to seed test run: ${error.message}`);
}

test.describe("onboarding checklist", () => {
  let userId: string;

  test.beforeAll(async () => {
    userId = await getTestUserId();
  });

  test.beforeEach(async () => {
    await cleanupUserData(userId);
  });

  test.afterAll(async () => {
    await cleanupUserData(userId);
  });

  test("new user sees full onboarding checklist", async ({ page }) => {
    await page.goto("/dashboard");

    // Should see the onboarding checklist, not the old empty state
    await expect(
      page.getByRole("navigation", { name: "Getting started" }),
    ).toBeVisible();
    await expect(page.getByText("Welcome to LLMAssert")).toBeVisible();
    await expect(page.getByText("Create your first project")).toBeVisible();
    await expect(page.getByText("Install the reporter")).toBeVisible();
    await expect(page.getByText("Run your first test")).toBeVisible();

    // Old empty state should NOT be visible
    await expect(page.getByText("No projects yet")).not.toBeVisible();
  });

  test("user with project but no runs sees banner", async ({ page }) => {
    await seedProject(userId);

    await page.goto("/dashboard");

    // Should see the banner variant with install instructions
    await expect(
      page.getByRole("navigation", { name: "Getting started" }),
    ).toBeVisible();
    await expect(
      page.getByText("pnpm add -D @llmassert/playwright"),
    ).toBeVisible();
    await expect(page.getByText("Get your API key")).toBeVisible();

    // Project grid should also be visible
    await expect(page.getByRole("heading", { name: "Projects" })).toBeVisible();
    await expect(page.getByText("E2E Onboarding Test")).toBeVisible();
  });

  test("user with runs sees normal dashboard", async ({ page }) => {
    const projectId = await seedProject(userId);
    await seedTestRun(projectId, userId);

    await page.goto("/dashboard");

    // Should see normal project grid with no onboarding
    await expect(page.getByRole("heading", { name: "Projects" })).toBeVisible();
    await expect(page.getByText("E2E Onboarding Test")).toBeVisible();

    // No onboarding UI
    await expect(
      page.getByRole("navigation", { name: "Getting started" }),
    ).not.toBeVisible();
    await expect(page.getByText("Welcome to LLMAssert")).not.toBeVisible();
  });

  test("dismiss checklist persists across refresh", async ({ page }) => {
    await page.goto("/dashboard");

    // Should see onboarding
    await expect(page.getByText("Welcome to LLMAssert")).toBeVisible();

    // Dismiss it
    await page
      .getByRole("button", { name: "Dismiss onboarding checklist" })
      .click();

    // Should disappear
    await expect(page.getByText("Welcome to LLMAssert")).not.toBeVisible();

    // Refresh and verify it stays dismissed
    await page.reload();
    await expect(page.getByText("Welcome to LLMAssert")).not.toBeVisible();
  });
});
