import { describe, it, expect } from "vitest";
import { validateRange, rangeToDays } from "@/lib/trends";

describe("validateRange", () => {
  it("returns '30d' for undefined input", () => {
    expect(validateRange(undefined)).toBe("30d");
  });

  it("returns '30d' for empty string", () => {
    expect(validateRange("")).toBe("30d");
  });

  it("accepts '7d'", () => {
    expect(validateRange("7d")).toBe("7d");
  });

  it("accepts '30d'", () => {
    expect(validateRange("30d")).toBe("30d");
  });

  it("accepts '90d'", () => {
    expect(validateRange("90d")).toBe("90d");
  });

  it("rejects invalid range and returns default", () => {
    expect(validateRange("999d")).toBe("30d");
  });

  it("rejects arbitrary strings", () => {
    expect(validateRange("all")).toBe("30d");
  });
});

describe("rangeToDays", () => {
  it("converts 7d to 7", () => {
    expect(rangeToDays("7d")).toBe(7);
  });

  it("converts 30d to 30", () => {
    expect(rangeToDays("30d")).toBe(30);
  });

  it("converts 90d to 90", () => {
    expect(rangeToDays("90d")).toBe(90);
  });
});
