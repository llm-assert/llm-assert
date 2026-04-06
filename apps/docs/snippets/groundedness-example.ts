import { test, expect } from "@llmassert/playwright";

test("chatbot answers are grounded in FAQ", async () => {
  const response = "We offer free shipping on orders over $50.";
  const faqDocs = "Free shipping available on orders exceeding $50 USD.";

  await expect(response).toBeGroundedIn(faqDocs);
});

test("creative response is NOT grounded", async () => {
  const response = "The aurora borealis danced across the sky.";
  const context = "Weather forecast: partly cloudy.";

  await expect(response).not.toBeGroundedIn(context);
});
