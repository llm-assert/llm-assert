import { test as setup, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";

const authFile = "e2e-smoke/.auth/user.json";

// Ensure the .auth directory exists before Playwright tries to write to it
mkdirSync(path.dirname(authFile), { recursive: true });

setup("authenticate for smoke test", async ({ page }) => {
  const email = process.env.E2E_TEST_EMAIL;
  const password = process.env.E2E_TEST_PASSWORD;

  if (!email || !password) {
    throw new Error("Missing E2E_TEST_EMAIL or E2E_TEST_PASSWORD");
  }

  // Sign in via the browser to capture cookie-based session
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL("/dashboard");
  await expect(page.locator("body")).not.toContainText("Sign in to LLMAssert");

  await page.context().storageState({ path: authFile });
});
