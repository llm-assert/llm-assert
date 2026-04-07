import { defineConfig } from "tsup";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/reporter.ts",
    "src/fixtures.ts",
    "src/json-reporter.ts",
    "src/preflight/check.ts",
  ],
  format: ["cjs", "esm"],
  dts: true,
  clean: true,
  splitting: false,
  sourcemap: true,
  external: ["@anthropic-ai/sdk"],
});
