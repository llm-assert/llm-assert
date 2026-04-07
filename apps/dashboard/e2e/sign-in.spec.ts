import { test, expect } from "@playwright/test";

test.describe("sign-in page", () => {
  test("renders OAuth error container with correct accessibility attributes", async ({
    page,
  }) => {
    await page.goto("/sign-in");

    const errorContainer = page.getByTestId("sign-in-form-oauth-error");
    await expect(errorContainer).toBeAttached();
    await expect(errorContainer).toHaveAttribute("role", "alert");
    await expect(errorContainer).toHaveAttribute("aria-atomic", "true");
    await expect(errorContainer).toHaveAttribute("tabindex", "-1");

    // Container is pre-rendered empty (no error on load)
    await expect(errorContainer).toBeEmpty();
  });

  test("GitHub OAuth button is accessible and clickable", async ({ page }) => {
    await page.goto("/sign-in");

    const githubButton = page.getByRole("button", {
      name: "Sign in with GitHub",
    });
    await expect(githubButton).toBeVisible();
    await expect(githubButton).toBeEnabled();
    await expect(githubButton).toHaveText("Continue with GitHub");
  });

  test("email error has data-testid and role alert", async ({ page }) => {
    await page.goto("/sign-in");

    await page.getByLabel("Email").fill("nonexistent@example.com");
    await page.getByLabel("Password").fill("wrongpassword");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();

    const emailError = page.getByTestId("sign-in-form-email-error");
    await expect(emailError).toBeVisible({ timeout: 10000 });
    await expect(emailError).toHaveAttribute("role", "alert");
  });
});
