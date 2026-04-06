import { test, expect } from "@playwright/test";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  createJSONReporter,
  createTempDir,
} from "../helpers/mock-json-reporter.js";
import {
  makeTestCase,
  makeTestResultWithEval,
  validEvalData,
} from "../helpers/mock-reporter.js";
import type { IngestPayload } from "../../src/types.js";

let tmpDir: string;
let cleanup: () => void;

test.beforeEach(() => {
  const tmp = createTempDir();
  tmpDir = tmp.dir;
  cleanup = tmp.cleanup;
});

test.afterEach(() => {
  cleanup();
});

test.describe("JSON reporter — Playwright integration", () => {
  test("printsToStdio returns false (file-based reporter)", () => {
    const reporter = createJSONReporter();
    expect(reporter.printsToStdio()).toBe(false);
  });
});

test.describe("JSON reporter — file output", () => {
  test("writes valid IngestPayload JSON to configured output file", async () => {
    const outputFile = join(tmpDir, "results.json");
    const reporter = createJSONReporter({ outputFile });
    reporter.begin();
    reporter.onTestEnd(
      makeTestCase("eval test"),
      makeTestResultWithEval(validEvalData),
    );
    await reporter.end();

    expect(existsSync(outputFile)).toBe(true);
    const payload: IngestPayload = JSON.parse(
      readFileSync(outputFile, "utf-8"),
    );
    expect(payload.project_slug).toBe("local");
    expect(payload.run_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    expect(payload.run.started_at).toBeTruthy();
    expect(payload.run.finished_at).toBeTruthy();
    expect(payload.evaluations).toHaveLength(1);

    // Verify all required snake_case evaluation fields are mapped correctly
    const evalOut = payload.evaluations[0];
    expect(evalOut.assertion_type).toBe("groundedness");
    expect(evalOut.test_name).toBe("eval test");
    expect(evalOut.test_file).toBe("test.ts");
    expect(evalOut.input_text).toBe("test input");
    expect(evalOut.score).toBe(0.85);
    expect(evalOut.reasoning).toBe("Well grounded");
    expect(evalOut.result).toBe("pass");
    expect(evalOut.judge_model).toBe("mock");
    expect(evalOut.judge_latency_ms).toBe(50);
    expect(evalOut.threshold).toBe(0.7);
    expect(evalOut.fallback_used).toBe(false);
    // Optional fields with undefined values are correctly omitted by JSON.stringify
    expect(evalOut.context_text).toBeUndefined();
    expect(evalOut.expected_value).toBeUndefined();
    expect(evalOut.judge_input_tokens).toBeUndefined();
    expect(evalOut.judge_output_tokens).toBeUndefined();
    expect(evalOut.judge_cost_usd).toBeUndefined();
  });

  test("maps all optional evaluation fields when present", async () => {
    const outputFile = join(tmpDir, "all-fields.json");
    const reporter = createJSONReporter({ outputFile });
    reporter.begin();
    reporter.onTestEnd(
      makeTestCase("full eval"),
      makeTestResultWithEval({
        ...validEvalData,
        contextText: "some context",
        expectedValue: "expected",
        thresholdSource: "remote",
        judgeInputTokens: 100,
        judgeOutputTokens: 50,
        judgeCostUsd: 0.005,
        inputTruncated: false,
        injectionDetected: true,
        rateLimited: false,
        judgeBackoffMs: 200,
        failureReason: null,
      }),
    );
    await reporter.end();

    const payload: IngestPayload = JSON.parse(
      readFileSync(outputFile, "utf-8"),
    );
    const evalOut = payload.evaluations[0];
    expect(evalOut.context_text).toBe("some context");
    expect(evalOut.expected_value).toBe("expected");
    expect(evalOut.threshold_source).toBe("remote");
    expect(evalOut.judge_input_tokens).toBe(100);
    expect(evalOut.judge_output_tokens).toBe(50);
    expect(evalOut.judge_cost_usd).toBe(0.005);
    expect(evalOut.input_truncated).toBe(false);
    expect(evalOut.injection_detected).toBe(true);
    expect(evalOut.rate_limited).toBe(false);
    expect(evalOut.judge_backoff_ms).toBe(200);
    // failure_reason: null is parsed as undefined (nullish coalescing in parseEvaluationAttachment)
    expect(evalOut.failure_reason).toBeUndefined();
  });

  test("uses default output path test-results/llmassert-results.json", () => {
    const reporter = createJSONReporter();
    expect(reporter.getOutputPath()).toBe(
      "test-results/llmassert-results.json",
    );
  });

  test("uses custom outputFile from config", () => {
    const reporter = createJSONReporter({
      outputFile: "custom/path/evals.json",
    });
    expect(reporter.getOutputPath()).toBe("custom/path/evals.json");
  });

  test("LLMASSERT_OUTPUT_FILE env var overrides config", () => {
    const original = process.env.LLMASSERT_OUTPUT_FILE;
    try {
      process.env.LLMASSERT_OUTPUT_FILE = "/tmp/env-override.json";
      const reporter = createJSONReporter({
        outputFile: "config-path.json",
      });
      expect(reporter.getOutputPath()).toBe("/tmp/env-override.json");
    } finally {
      if (original === undefined) {
        delete process.env.LLMASSERT_OUTPUT_FILE;
      } else {
        process.env.LLMASSERT_OUTPUT_FILE = original;
      }
    }
  });

  test("does not write file when no evaluations collected", async () => {
    const outputFile = join(tmpDir, "empty.json");
    const reporter = createJSONReporter({ outputFile });
    reporter.begin();
    await reporter.end();

    expect(existsSync(outputFile)).toBe(false);
  });

  test("creates parent directories if they do not exist", async () => {
    const outputFile = join(tmpDir, "nested", "deep", "results.json");
    const reporter = createJSONReporter({ outputFile });
    reporter.begin();
    reporter.onTestEnd(
      makeTestCase("test"),
      makeTestResultWithEval(validEvalData),
    );
    await reporter.end();

    expect(existsSync(outputFile)).toBe(true);
  });

  test("uses custom projectSlug in output", async () => {
    const outputFile = join(tmpDir, "slug.json");
    const reporter = createJSONReporter({
      outputFile,
      projectSlug: "my-project",
    });
    reporter.begin();
    reporter.onTestEnd(
      makeTestCase("test"),
      makeTestResultWithEval(validEvalData),
    );
    await reporter.end();

    const payload: IngestPayload = JSON.parse(
      readFileSync(outputFile, "utf-8"),
    );
    expect(payload.project_slug).toBe("my-project");
  });

  test("includes metadata in output", async () => {
    const outputFile = join(tmpDir, "meta.json");
    const reporter = createJSONReporter({
      outputFile,
      metadata: { env: "test", version: "1.0" },
    });
    reporter.begin();
    reporter.onTestEnd(
      makeTestCase("test"),
      makeTestResultWithEval(validEvalData),
    );
    await reporter.end();

    const payload: IngestPayload = JSON.parse(
      readFileSync(outputFile, "utf-8"),
    );
    expect(payload.run.metadata).toEqual({ env: "test", version: "1.0" });
  });

  test("pretty-prints JSON with 2-space indentation", async () => {
    const outputFile = join(tmpDir, "pretty.json");
    const reporter = createJSONReporter({ outputFile });
    reporter.begin();
    reporter.onTestEnd(
      makeTestCase("test"),
      makeTestResultWithEval(validEvalData),
    );
    await reporter.end();

    const raw = readFileSync(outputFile, "utf-8");
    // Verify indentation — second line should start with 2 spaces
    const lines = raw.split("\n");
    expect(lines[1]).toMatch(/^ {2}"/);
  });
});

test.describe("JSON reporter — error handling", () => {
  test("onError: throw raises on write failure", async () => {
    // Use an invalid path (file as directory) to force ENOTDIR
    const outputFile = join(tmpDir, "results.json");
    // Write a file first, then try to use it as a directory
    const { writeFileSync } = await import("node:fs");
    writeFileSync(outputFile, "block");
    const badPath = join(outputFile, "nested", "file.json");

    const reporter = createJSONReporter({
      outputFile: badPath,
      onError: "throw",
    });
    reporter.begin();
    reporter.onTestEnd(
      makeTestCase("test"),
      makeTestResultWithEval(validEvalData),
    );

    await expect(reporter.end()).rejects.toThrow("[LLMAssert]");
  });

  test("onError: warn logs to stderr without throwing", async () => {
    const errors: string[] = [];
    const originalError = console.error;
    console.error = (...args: unknown[]) => errors.push(args.join(" "));

    try {
      const outputFile = join(tmpDir, "results.json");
      const { writeFileSync } = await import("node:fs");
      writeFileSync(outputFile, "block");
      const badPath = join(outputFile, "nested", "file.json");

      const reporter = createJSONReporter({
        outputFile: badPath,
        onError: "warn",
      });
      reporter.begin();
      reporter.onTestEnd(
        makeTestCase("test"),
        makeTestResultWithEval(validEvalData),
      );
      await reporter.end();

      expect(errors.some((e) => e.includes("[LLMAssert] Warning:"))).toBe(true);
    } finally {
      console.error = originalError;
    }
  });

  test("onError: silent suppresses errors", async () => {
    const errors: string[] = [];
    const originalError = console.error;
    console.error = (...args: unknown[]) => errors.push(args.join(" "));

    try {
      const outputFile = join(tmpDir, "results.json");
      const { writeFileSync } = await import("node:fs");
      writeFileSync(outputFile, "block");
      const badPath = join(outputFile, "nested", "file.json");

      const reporter = createJSONReporter({
        outputFile: badPath,
        onError: "silent",
      });
      reporter.begin();
      reporter.onTestEnd(
        makeTestCase("test"),
        makeTestResultWithEval(validEvalData),
      );
      await reporter.end();

      // Should have no LLMAssert warning messages (cost summary is fine)
      expect(errors.some((e) => e.includes("[LLMAssert] Warning:"))).toBe(
        false,
      );
    } finally {
      console.error = originalError;
    }
  });
});

test.describe("JSON reporter — hardening summary", () => {
  test("computes hardening summary from evaluations", async () => {
    const outputFile = join(tmpDir, "hardening.json");
    const reporter = createJSONReporter({ outputFile });
    reporter.begin();

    // Normal eval
    reporter.onTestEnd(
      makeTestCase("normal"),
      makeTestResultWithEval(validEvalData),
    );

    // Truncated input
    reporter.onTestEnd(
      makeTestCase("truncated"),
      makeTestResultWithEval({
        ...validEvalData,
        inputTruncated: true,
        judgeBackoffMs: 500,
      }),
    );

    // Rate limited
    reporter.onTestEnd(
      makeTestCase("rate-limited"),
      makeTestResultWithEval({
        ...validEvalData,
        rateLimited: true,
        judgeBackoffMs: 1000,
      }),
    );

    // Injection detected
    reporter.onTestEnd(
      makeTestCase("injection"),
      makeTestResultWithEval({
        ...validEvalData,
        injectionDetected: true,
      }),
    );

    await reporter.end();

    const payload: IngestPayload = JSON.parse(
      readFileSync(outputFile, "utf-8"),
    );
    expect(payload.run.hardening_summary).toEqual({
      total_input_rejected: 2, // truncated + injection
      total_rate_limited: 1,
      total_backoff_ms: 1500, // 500 + 1000
    });
  });
});

test.describe("JSON reporter — console output", () => {
  test("emits cost summary and write confirmation to stderr", async () => {
    const errors: string[] = [];
    const originalError = console.error;
    console.error = (...args: unknown[]) => errors.push(args.join(" "));

    try {
      const outputFile = join(tmpDir, "console.json");
      const reporter = createJSONReporter({ outputFile });
      reporter.begin();
      reporter.onTestEnd(
        makeTestCase("test"),
        makeTestResultWithEval({
          ...validEvalData,
          judgeCostUsd: 0.001234,
        }),
      );
      await reporter.end();

      expect(errors.some((e) => e.includes("Judge cost: $0.001234"))).toBe(
        true,
      );
      expect(
        errors.some(
          (e) =>
            e.includes("Results written to") && e.includes("1 evaluations"),
        ),
      ).toBe(true);
    } finally {
      console.error = originalError;
    }
  });
});

test.describe("JSON reporter — large run warning", () => {
  test("warns when evaluations exceed ingest batch limit", async () => {
    const errors: string[] = [];
    const originalError = console.error;
    console.error = (...args: unknown[]) => errors.push(args.join(" "));

    try {
      const outputFile = join(tmpDir, "large.json");
      const reporter = createJSONReporter({ outputFile });
      reporter.begin();
      for (let i = 0; i < 501; i++) {
        reporter.onTestEnd(
          makeTestCase(`test-${i}`),
          makeTestResultWithEval(validEvalData),
        );
      }
      await reporter.end();

      expect(
        errors.some(
          (e) => e.includes("501 evaluations exceed") && e.includes("500"),
        ),
      ).toBe(true);
    } finally {
      console.error = originalError;
    }
  });
});

test.describe("JSON reporter — CI metadata", () => {
  test("omits ci_provider when not running in CI", async () => {
    const envBackup = { CI: process.env.CI };
    try {
      delete process.env.CI;
      const outputFile = join(tmpDir, "no-ci.json");
      const reporter = createJSONReporter({ outputFile });
      reporter.begin();
      reporter.onTestEnd(
        makeTestCase("test"),
        makeTestResultWithEval(validEvalData),
      );
      await reporter.end();

      const payload: IngestPayload = JSON.parse(
        readFileSync(outputFile, "utf-8"),
      );
      expect(payload.run.ci_provider).toBeUndefined();
    } finally {
      if (envBackup.CI === undefined) {
        delete process.env.CI;
      } else {
        process.env.CI = envBackup.CI;
      }
    }
  });

  test("includes GitHub Actions metadata when env vars set", async () => {
    const envBackup = {
      CI: process.env.CI,
      GITHUB_ACTIONS: process.env.GITHUB_ACTIONS,
      GITHUB_SERVER_URL: process.env.GITHUB_SERVER_URL,
      GITHUB_REPOSITORY: process.env.GITHUB_REPOSITORY,
      GITHUB_RUN_ID: process.env.GITHUB_RUN_ID,
      GITHUB_REF_NAME: process.env.GITHUB_REF_NAME,
      GITHUB_SHA: process.env.GITHUB_SHA,
    };

    try {
      process.env.CI = "true";
      process.env.GITHUB_ACTIONS = "true";
      process.env.GITHUB_SERVER_URL = "https://github.com";
      process.env.GITHUB_REPOSITORY = "llm-assert/llm-assert";
      process.env.GITHUB_RUN_ID = "12345";
      process.env.GITHUB_REF_NAME = "feat/json-reporter";
      process.env.GITHUB_SHA = "abc123def";

      const outputFile = join(tmpDir, "ci.json");
      const reporter = createJSONReporter({ outputFile });
      reporter.begin();
      reporter.onTestEnd(
        makeTestCase("test"),
        makeTestResultWithEval(validEvalData),
      );
      await reporter.end();

      const payload: IngestPayload = JSON.parse(
        readFileSync(outputFile, "utf-8"),
      );
      expect(payload.run.ci_provider).toBe("github-actions");
      expect(payload.run.ci_run_url).toBe(
        "https://github.com/llm-assert/llm-assert/actions/runs/12345",
      );
      expect(payload.run.branch).toBe("feat/json-reporter");
      expect(payload.run.commit_sha).toBe("abc123def");
    } finally {
      for (const [key, value] of Object.entries(envBackup)) {
        if (value === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = value;
        }
      }
    }
  });
});
