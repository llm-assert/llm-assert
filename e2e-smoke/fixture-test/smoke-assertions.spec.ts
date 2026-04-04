/**
 * Inner fixture test for the e2e smoke test.
 *
 * Uses @llmassert/playwright matchers (from the built dist/) with the
 * LLMAssertReporter attached via playwright.config.ts. The reporter
 * sends results to /api/ingest on the running dashboard.
 *
 * Two groundedness assertions:
 * 1. Pass case: input is a verbatim quote from context
 * 2. Fail case: input contradicts context
 */
import { test, expect } from "@llmassert/playwright";

const CONTEXT =
  "The capital of France is Paris. It has been the capital since the 10th century. Paris is known for the Eiffel Tower, which was built in 1889.";

test.describe("smoke: groundedness assertions", () => {
  test("pass: verbatim quote from context", async () => {
    await expect(
      "The capital of France is Paris. The Eiffel Tower was built in 1889.",
    ).toBeGroundedIn(CONTEXT);
  });

  test("fail: contradicts context", async () => {
    await expect(
      "The capital of France is Lyon. The Eiffel Tower was built in 1920.",
    ).not.toBeGroundedIn(CONTEXT);
  });
});
