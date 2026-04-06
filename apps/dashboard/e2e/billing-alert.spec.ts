import { test, expect } from "@playwright/test";
import {
  seedPastDue,
  seedQuotaWarning,
  seedQuotaExceeded,
  resetSubscription,
} from "./billing.setup";

const email = process.env.E2E_TEST_EMAIL!;

test.afterEach(async ({ page }) => {
  await page.evaluate(() => sessionStorage.clear());
  await resetSubscription(email);
});

test.describe("Billing alert banner", () => {
  test("healthy subscription shows no banner on /dashboard", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    await expect(page.getByTestId("billing-alert-banner")).not.toBeVisible();
    await expect(page.getByTestId("quota-warning-banner")).not.toBeVisible();
    await expect(page.getByTestId("quota-exceeded-banner")).not.toBeVisible();
  });

  test("past_due shows red banner with Update Payment CTA", async ({
    page,
  }) => {
    await seedPastDue(email);
    await page.goto("/dashboard");
    const banner = page.getByTestId("billing-alert-banner");
    await expect(banner).toBeVisible();
    await expect(banner).toContainText("Payment past due");
    await expect(page.getByTestId("billing-alert-cta")).toBeVisible();
  });

  test("past_due banner appears on runs page too", async ({ page }) => {
    await seedPastDue(email);
    await page.goto("/runs");
    await expect(page.getByTestId("billing-alert-banner")).toBeVisible();
  });

  test("past_due banner has no dismiss button", async ({ page }) => {
    await seedPastDue(email);
    await page.goto("/dashboard");
    await expect(page.getByTestId("billing-alert-banner")).toBeVisible();
    await expect(page.getByTestId("quota-warning-dismiss")).not.toBeVisible();
  });

  test("quota at 96% shows amber warning banner", async ({ page }) => {
    await seedQuotaWarning(email, 96, 100);
    await page.goto("/dashboard");
    const banner = page.getByTestId("quota-warning-banner");
    await expect(banner).toBeVisible();
    await expect(banner).toContainText("remaining");
    await expect(page.getByTestId("quota-warning-cta")).toBeVisible();
  });

  test("quota at 100% shows red exceeded banner", async ({ page }) => {
    await seedQuotaExceeded(email);
    await page.goto("/dashboard");
    const banner = page.getByTestId("quota-exceeded-banner");
    await expect(banner).toBeVisible();
    await expect(banner).toContainText("limit reached");
    await expect(page.getByTestId("quota-exceeded-cta")).toBeVisible();
  });

  test("quota_exceeded banner has no dismiss button", async ({ page }) => {
    await seedQuotaExceeded(email);
    await page.goto("/dashboard");
    await expect(page.getByTestId("quota-exceeded-banner")).toBeVisible();
    await expect(page.getByTestId("quota-warning-dismiss")).not.toBeVisible();
  });

  test("dismiss quota warning persists across soft navigation", async ({
    page,
  }) => {
    await seedQuotaWarning(email, 96, 100);
    await page.goto("/dashboard");
    const banner = page.getByTestId("quota-warning-banner");
    await expect(banner).toBeVisible();

    // Dismiss the banner
    await page.getByTestId("quota-warning-dismiss").click();
    await expect(banner).not.toBeVisible();

    // Navigate to another page (soft nav within dashboard)
    await page.getByRole("link", { name: "Test Runs" }).click();
    await page.waitForURL("/runs");

    // Banner should stay dismissed
    await expect(page.getByTestId("quota-warning-banner")).not.toBeVisible();
  });
});
