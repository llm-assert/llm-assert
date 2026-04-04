import { describe, it, expect } from "vitest";
import { getAuthErrorConfig } from "./error-messages";

describe("getAuthErrorConfig", () => {
  const expectedCodes = [
    "invalid_code",
    "expired_code",
    "access_denied",
    "session_expired",
    "email_not_confirmed",
    "provider_error",
    "unknown",
  ];

  it.each(expectedCodes)("returns config for known code: %s", (code) => {
    const config = getAuthErrorConfig(code);
    expect(config.title).toBeTruthy();
    expect(config.message).toBeTruthy();
    expect(config.cta.label).toBeTruthy();
    expect(config.cta.href).toBeTruthy();
  });

  it("returns fallback for unknown code", () => {
    const config = getAuthErrorConfig("totally_unknown_code");
    expect(config.title).toBe("Authentication Failed");
    expect(config.cta.href).toBe("/sign-in");
  });

  it("returns fallback for undefined code", () => {
    const config = getAuthErrorConfig(undefined);
    expect(config.title).toBe("Authentication Failed");
  });

  it("returns secondaryCta for access_denied", () => {
    const config = getAuthErrorConfig("access_denied");
    expect(config.secondaryCta).toBeDefined();
    expect(config.secondaryCta!.label).toContain("Email");
  });

  it("does not return secondaryCta for session_expired", () => {
    const config = getAuthErrorConfig("session_expired");
    expect(config.secondaryCta).toBeUndefined();
  });
});
