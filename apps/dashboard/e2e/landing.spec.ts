import { test, expect } from "@playwright/test";

test.describe("landing page", () => {
  test("loads at / without auth redirect", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL("/");
    await expect(page).not.toHaveURL(/sign-in/);
  });

  test("hero heading is visible", async ({ page }) => {
    await page.goto("/");
    const heading = page.locator("h1");
    await expect(heading).toBeVisible();
    await expect(heading).toContainText("Assert the unpredictable");
  });

  test("all sections are present", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#hero")).toBeVisible();
    await expect(page.locator("#how-it-works")).toBeVisible();
    await expect(page.locator("#features")).toBeVisible();
    await expect(page.locator("#pricing")).toBeVisible();
    await expect(page.locator("#cta")).toBeVisible();
  });

  test("Get Started CTA links to sign-up", async ({ page }) => {
    await page.goto("/");
    const cta = page.locator('a[href="/sign-up"]').first();
    await expect(cta).toBeVisible();
  });

  test("page title contains LLMAssert", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/LLMAssert/);
  });

  test("meta description is present", async ({ page }) => {
    await page.goto("/");
    const description = page.locator('meta[name="description"]');
    await expect(description).toHaveAttribute("content", /Playwright/);
  });
});
