import { defineConfig } from "@playwright/test";

export default defineConfig({
  reporter: [
    ["list"],
    [
      "@llmassert/playwright/reporter",
      {
        projectSlug: "my-project",
        apiKey: process.env.LLMASSERT_API_KEY,
      },
    ],
  ],
});
