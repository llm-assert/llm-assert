import { test, expect } from "@llmassert/playwright";

// Per-describe judge override
test.describe("high-stakes evaluations", () => {
  test.use({ judgeConfig: { timeout: 15000 } });

  test("critical response is grounded", async () => {
    const response = "We process refunds within 5 business days.";
    const context = "Refunds are processed in 3-5 business days.";

    await expect(response).toBeGroundedIn(context, { threshold: 0.95 });
  });
});
