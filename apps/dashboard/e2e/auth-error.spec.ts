import { test, expect } from "@playwright/test";

test.describe("auth error page", () => {
  test("displays error message for expired_code", async ({ page }) => {
    await page.goto("/auth/error?code=expired_code");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Link Expired",
    );
    await expect(page.getByText("sign-in link has expired")).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Back to Sign In" }),
    ).toBeVisible();
  });

  test("displays generic fallback with no params", async ({ page }) => {
    await page.goto("/auth/error");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Authentication Failed",
    );
    await expect(page.getByText("Something went wrong")).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Back to Sign In" }),
    ).toBeVisible();
  });

  test("displays access_denied with secondary CTA", async ({ page }) => {
    await page.goto("/auth/error?code=access_denied");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Permission Required",
    );
    await expect(
      page.getByRole("link", { name: "Try Again with GitHub" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Sign In with Email" }),
    ).toBeVisible();
  });

  test("displays provider_error with email fallback CTA", async ({ page }) => {
    await page.goto("/auth/error?code=provider_error");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Provider Unavailable",
    );
    await expect(
      page.getByRole("link", { name: "Sign In with Email" }),
    ).toBeVisible();
  });

  test("parses hash fragment error when no searchParams code", async ({
    page,
  }) => {
    await page.goto("/auth/error#error_code=expired_code");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Link Expired",
    );
  });

  test("error page is accessible without authentication", async ({ page }) => {
    // Verify no redirect to /sign-in (proxy.ts whitelists /auth/error)
    await page.goto("/auth/error?code=session_expired");
    await expect(page).toHaveURL(/\/auth\/error/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Session Expired",
    );
  });
});
