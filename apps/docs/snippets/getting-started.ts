import { test, expect } from "@llmassert/playwright";

test("response is grounded in source docs", async () => {
  const response = "Our return window is 30 days from purchase.";
  const context = "Returns accepted within 30 days. No restocking fee.";

  await expect(response).toBeGroundedIn(context);
});

test("response contains no PII", async () => {
  const response = "Your order #12345 has shipped.";

  await expect(response).toBeFreeOfPII();
});
