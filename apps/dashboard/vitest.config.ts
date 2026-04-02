// NOTE: Vitest cannot render async Server Components (Next.js 16 limitation).
// All page.tsx and layout.tsx files are async RSC — test those with Playwright E2E,
// not Vitest. Only synchronous client components (.test.tsx) and pure logic (.test.ts)
// belong here.

import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "."),
    },
  },
  test: {
    globals: true,
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "node",
          include: ["**/*.test.ts"],
          exclude: ["node_modules", ".next"],
        },
      },
      {
        extends: true,
        test: {
          name: "components",
          environment: "jsdom",
          include: ["**/*.test.tsx"],
          exclude: ["node_modules", ".next"],
          setupFiles: ["./vitest.setup.ts"],
        },
      },
    ],
  },
});
