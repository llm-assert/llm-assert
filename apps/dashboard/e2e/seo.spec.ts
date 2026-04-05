import { test, expect } from "@playwright/test";

test.describe("SEO infrastructure", () => {
  test("robots.txt is reachable and well-formed", async ({ request }) => {
    const res = await request.get("/robots.txt");
    expect(res.status()).toBe(200);
    const body = await res.text();
    expect(body).toContain("User-Agent:");
    expect(body).toContain("Sitemap:");
    expect(body).toContain("Disallow: /dashboard");
    expect(body).toContain("Disallow: /projects");
    expect(body).toContain("Disallow: /api/");
  });

  test("sitemap.xml is reachable and contains root URL", async ({
    request,
  }) => {
    const res = await request.get("/sitemap.xml");
    expect(res.status()).toBe(200);
    const contentType = res.headers()["content-type"] ?? "";
    expect(contentType).toContain("xml");
    const body = await res.text();
    expect(body).toContain("<loc>");
  });

  test("OG image returns a PNG", async ({ request }) => {
    const res = await request.get("/opengraph-image");
    expect(res.status()).toBe(200);
    const contentType = res.headers()["content-type"] ?? "";
    expect(contentType).toContain("image/png");
    const buffer = await res.body();
    expect(buffer.byteLength).toBeGreaterThan(0);
  });

  test("landing page has OG meta tags", async ({ page }) => {
    await page.goto("/");
    const ogTitle = page.locator('meta[property="og:title"]');
    await expect(ogTitle).toHaveAttribute("content", /.+/);
    const ogDescription = page.locator('meta[property="og:description"]');
    await expect(ogDescription).toHaveAttribute("content", /.+/);
    const ogImage = page.locator('meta[property="og:image"]');
    await expect(ogImage).toHaveAttribute("content", /.+/);
  });
});
