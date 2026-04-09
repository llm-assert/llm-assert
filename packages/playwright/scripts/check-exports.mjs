/**
 * Package export validation — runtime import check.
 *
 * Verifies that all @llmassert/playwright subpath exports resolve
 * correctly in both ESM (import()) and CJS (require()) module formats.
 * Uses Node.js self-referencing (the package imports its own name via
 * the exports map in package.json).
 *
 * Run after building the package:
 *   pnpm run build && node scripts/check-exports.mjs
 */

import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

let failures = 0;

function assert(condition, subpath, format, message) {
  if (!condition) {
    console.error(`  FAIL [${format}] ${subpath}: ${message}`);
    failures++;
    return false;
  }
  return true;
}

function assertExport(mod, name, expectedType, subpath, format) {
  const value = mod[name];
  return assert(
    typeof value === expectedType,
    subpath,
    format,
    `expected "${name}" to be ${expectedType}, got ${typeof value}`,
  );
}

function ok(label) {
  console.log(`  ${label.padEnd(22)}OK`);
}

// ---------------------------------------------------------------------------
// ESM import() checks
// ---------------------------------------------------------------------------

console.log("--- ESM import() checks ---\n");

const esmMain = await import("@llmassert/playwright");
const esmMainOk =
  assertExport(esmMain, "expect", "function", ".", "ESM") &
  assertExport(esmMain, "test", "function", ".", "ESM") &
  assertExport(esmMain, "JudgeClient", "function", ".", "ESM") &
  assertExport(esmMain, "calculateCostUsd", "function", ".", "ESM");
if (esmMainOk) ok(". (main)");

const esmReporter = await import("@llmassert/playwright/reporter");
if (
  assert(
    typeof esmReporter.default === "function",
    "./reporter",
    "ESM",
    "expected default export to be function, got " + typeof esmReporter.default,
  )
)
  ok("./reporter");

const esmJsonReporter = await import("@llmassert/playwright/json-reporter");
if (
  assert(
    typeof esmJsonReporter.default === "function",
    "./json-reporter",
    "ESM",
    "expected default export to be function, got " +
      typeof esmJsonReporter.default,
  )
)
  ok("./json-reporter");

const esmFixtures = await import("@llmassert/playwright/fixtures");
if (assertExport(esmFixtures, "test", "function", "./fixtures", "ESM"))
  ok("./fixtures");

const esmTesting = await import("@llmassert/playwright/testing");
const esmTestingOk =
  assertExport(esmTesting, "test", "function", "./testing", "ESM") &
  assertExport(esmTesting, "expect", "function", "./testing", "ESM") &
  assert(
    esmTesting.JudgeClient === undefined,
    "./testing",
    "ESM",
    "JudgeClient should not be exported from ./testing",
  ) &
  assert(
    esmTesting.calculateCostUsd === undefined,
    "./testing",
    "ESM",
    "calculateCostUsd should not be exported from ./testing",
  ) &
  assert(
    esmTesting.preflightCheck === undefined,
    "./testing",
    "ESM",
    "preflightCheck should not be exported from ./testing",
  );
if (esmTestingOk) ok("./testing");

const esmPreflight = await import("@llmassert/playwright/preflight");
if (
  assertExport(esmPreflight, "preflightCheck", "function", "./preflight", "ESM")
)
  ok("./preflight");

// ---------------------------------------------------------------------------
// CJS require() checks
// ---------------------------------------------------------------------------

console.log("\n--- CJS require() checks ---\n");

const cjsMain = require("@llmassert/playwright");
const cjsMainOk =
  assertExport(cjsMain, "expect", "function", ".", "CJS") &
  assertExport(cjsMain, "test", "function", ".", "CJS") &
  assertExport(cjsMain, "JudgeClient", "function", ".", "CJS") &
  assertExport(cjsMain, "calculateCostUsd", "function", ".", "CJS");
if (cjsMainOk) ok(". (main)");

const cjsReporter = require("@llmassert/playwright/reporter");
if (
  assert(
    typeof cjsReporter === "function" ||
      typeof cjsReporter.default === "function",
    "./reporter",
    "CJS",
    "expected module or .default to be function, got module=" +
      typeof cjsReporter +
      " .default=" +
      typeof cjsReporter.default,
  )
)
  ok("./reporter");

const cjsJsonReporter = require("@llmassert/playwright/json-reporter");
if (
  assert(
    typeof cjsJsonReporter === "function" ||
      typeof cjsJsonReporter.default === "function",
    "./json-reporter",
    "CJS",
    "expected module or .default to be function, got module=" +
      typeof cjsJsonReporter +
      " .default=" +
      typeof cjsJsonReporter.default,
  )
)
  ok("./json-reporter");

const cjsFixtures = require("@llmassert/playwright/fixtures");
if (assertExport(cjsFixtures, "test", "function", "./fixtures", "CJS"))
  ok("./fixtures");

const cjsTesting = require("@llmassert/playwright/testing");
const cjsTestingOk =
  assertExport(cjsTesting, "test", "function", "./testing", "CJS") &
  assertExport(cjsTesting, "expect", "function", "./testing", "CJS") &
  assert(
    cjsTesting.JudgeClient === undefined,
    "./testing",
    "CJS",
    "JudgeClient should not be exported from ./testing",
  ) &
  assert(
    cjsTesting.calculateCostUsd === undefined,
    "./testing",
    "CJS",
    "calculateCostUsd should not be exported from ./testing",
  ) &
  assert(
    cjsTesting.preflightCheck === undefined,
    "./testing",
    "CJS",
    "preflightCheck should not be exported from ./testing",
  );
if (cjsTestingOk) ok("./testing");

const cjsPreflight = require("@llmassert/playwright/preflight");
if (
  assertExport(cjsPreflight, "preflightCheck", "function", "./preflight", "CJS")
)
  ok("./preflight");

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log("");
if (failures > 0) {
  console.error(`${failures} export check(s) failed.`);
  process.exit(1);
} else {
  console.log("All export checks passed (6 ESM + 6 CJS).");
}
