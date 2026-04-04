import { test, expect } from "@playwright/test";
import {
  resolveThreshold,
  setWorkerThresholds,
  getWorkerThresholds,
} from "../../src/threshold/client.js";

test.afterEach(() => setWorkerThresholds(null));

test.describe("resolveThreshold", () => {
  test("returns default 0.7 when no remote or inline", () => {
    const result = resolveThreshold("groundedness");
    expect(result).toEqual({ value: 0.7, source: "default" });
  });

  test("returns inline when provided (highest priority)", () => {
    setWorkerThresholds({ groundedness: 0.85 });
    const result = resolveThreshold("groundedness", 0.6);
    expect(result).toEqual({ value: 0.6, source: "inline" });
  });

  test("returns remote when no inline override", () => {
    setWorkerThresholds({ groundedness: 0.85, pii: 0.95 });
    const result = resolveThreshold("groundedness");
    expect(result).toEqual({ value: 0.85, source: "remote" });
  });

  test("falls back to default for assertion types not in remote", () => {
    setWorkerThresholds({ groundedness: 0.85 });
    const result = resolveThreshold("sentiment");
    expect(result).toEqual({ value: 0.7, source: "default" });
  });

  test("inline overrides remote for specific assertion type", () => {
    setWorkerThresholds({
      groundedness: 0.85,
      pii: 0.95,
      sentiment: 0.8,
      schema: 0.75,
      fuzzy: 0.6,
    });
    const result = resolveThreshold("pii", 0.5);
    expect(result).toEqual({ value: 0.5, source: "inline" });
  });

  test("all three sources tracked independently in same run", () => {
    setWorkerThresholds({ groundedness: 0.85 });

    const inlineResult = resolveThreshold("groundedness", 0.6);
    const remoteResult = resolveThreshold("groundedness");
    const defaultResult = resolveThreshold("sentiment");

    expect(inlineResult.source).toBe("inline");
    expect(remoteResult.source).toBe("remote");
    expect(defaultResult.source).toBe("default");
  });
});

test.describe("worker threshold singleton", () => {
  test("starts as null", () => {
    expect(getWorkerThresholds()).toBeNull();
  });

  test("set and get round-trip", () => {
    const thresholds = { groundedness: 0.85, pii: 0.9 };
    setWorkerThresholds(thresholds);
    expect(getWorkerThresholds()).toEqual(thresholds);
  });

  test("can be cleared back to null", () => {
    setWorkerThresholds({ groundedness: 0.85 });
    setWorkerThresholds(null);
    expect(getWorkerThresholds()).toBeNull();
  });
});
