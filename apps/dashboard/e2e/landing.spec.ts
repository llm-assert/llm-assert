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

  test.describe("pricing section", () => {
    test("free tier callout is visible", async ({ page }) => {
      await page.goto("/");
      const callout = page.getByTestId("pricing-section-free-callout");
      await expect(callout).toBeVisible();
      await expect(callout).toContainText("Free");
      await expect(callout).toContainText("No credit card required");
    });

    test("paid tier cards render with correct labels", async ({ page }) => {
      await page.goto("/");
      for (const tier of ["starter", "pro", "team"]) {
        const card = page.getByTestId(`pricing-section-plan-card-${tier}`);
        await expect(card).toBeVisible();
      }
      await expect(
        page.getByTestId("pricing-section-plan-card-starter"),
      ).toContainText("Starter");
      await expect(
        page.getByTestId("pricing-section-plan-card-pro"),
      ).toContainText("Pro");
      await expect(
        page.getByTestId("pricing-section-plan-card-team"),
      ).toContainText("Team");
    });

    test("prices are displayed for paid tiers", async ({ page }) => {
      await page.goto("/");
      for (const tier of ["starter", "pro", "team"]) {
        const price = page.getByTestId(`pricing-section-price-${tier}`);
        await expect(price).toBeVisible();
        await expect(price).toContainText("$");
        await expect(price).toContainText("/month");
      }
    });

    test("Pro card has Popular badge", async ({ page }) => {
      await page.goto("/");
      const proCard = page.getByTestId("pricing-section-plan-card-pro");
      await expect(proCard).toContainText("Popular");
    });

    test("all CTA buttons link to /sign-up", async ({ page }) => {
      await page.goto("/");
      for (const tier of ["starter", "pro", "team"]) {
        const cta = page.getByTestId(`pricing-section-cta-${tier}`);
        await expect(cta).toHaveAttribute("href", "/sign-up");
      }
    });

    test("feature matrix renders on paid tier cards", async ({ page }) => {
      await page.goto("/");
      const proCard = page.getByTestId("pricing-section-plan-card-pro");
      await expect(proCard).toContainText("Dashboard analytics");
      await expect(proCard).toContainText("All 5 assertion types");
      await expect(proCard).toContainText("CI integration");
    });

    test("paid tier CTAs have accessible labels", async ({ page }) => {
      await page.goto("/");
      for (const [tier, label] of [
        ["starter", "Get Started — Starter plan"],
        ["pro", "Get Started — Pro plan"],
        ["team", "Get Started — Team plan"],
      ] as const) {
        const cta = page.getByTestId(`pricing-section-cta-${tier}`);
        await expect(cta).toHaveAttribute("aria-label", label);
      }
    });
  });
});
