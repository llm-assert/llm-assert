import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/reporter.ts", "src/fixtures.ts"],
  format: ["cjs", "esm"],
  dts: true,
  clean: true,
  splitting: false,
  sourcemap: true,
});
