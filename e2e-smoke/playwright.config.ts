import { defineConfig, devices } from "@playwright/test";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

// Load dashboard .env.local for Supabase + E2E vars.
// dotenv is a dashboard devDependency, so we parse manually here.
const envPath = path.resolve(__dirname, "../apps/dashboard/.env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: ".",
  testMatch: /smoke\.spec\.ts/,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: "list",
  timeout: 120_000,
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "smoke-setup",
      testMatch: /smoke-auth\.setup\.ts/,
    },
    {
      name: "smoke",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "e2e-smoke/.auth/user.json",
      },
      testMatch: /smoke\.spec\.ts/,
      dependencies: ["smoke-setup"],
    },
  ],
  globalSetup: "./smoke-setup.ts",
  globalTeardown: "./smoke-teardown.ts",
  webServer: {
    command: "pnpm --filter dashboard dev",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    cwd: path.resolve(__dirname, ".."),
  },
});
