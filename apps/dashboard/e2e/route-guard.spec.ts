import { test, expect } from "@playwright/test";

test.describe("unauthenticated route guards", () => {
  test("visiting / without auth shows landing page (public)", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page).toHaveURL("/");
    await expect(page).not.toHaveURL(/sign-in/);
  });

  test("visiting /dashboard without auth redirects to /sign-in", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/sign-in/);
  });

  test("visiting /projects without auth redirects to /sign-in", async ({
    page,
  }) => {
    await page.goto("/projects");
    await expect(page).toHaveURL(/sign-in/);
  });
});

test.describe("open redirect protection (SEC-04)", () => {
  test("auth callback rejects protocol-relative next param", async ({
    page,
  }) => {
    await page.goto("/auth/callback?next=//evil.com");
    await expect(page).not.toHaveURL(/evil\.com/);
  });

  test("auth callback rejects backslash bypass in next param", async ({
    page,
  }) => {
    await page.goto("/auth/callback?next=" + encodeURIComponent("/\\evil.com"));
    await expect(page).not.toHaveURL(/evil\.com/);
  });

  test("auth callback rejects embedded protocol in next param", async ({
    page,
  }) => {
    await page.goto(
      "/auth/callback?next=" + encodeURIComponent("https://evil.com"),
    );
    await expect(page).not.toHaveURL(/evil\.com/);
  });
});
