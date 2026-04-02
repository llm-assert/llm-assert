import { createHash } from "node:crypto";
import { generateApiKey } from "./api-keys";

describe("generateApiKey", () => {
  const deterministicRandom = (size: number) => Buffer.alloc(size, 0xab);

  it("returns raw key starting with lma_", () => {
    const { raw } = generateApiKey(deterministicRandom);
    expect(raw).toMatch(/^lma_/);
  });

  it("returns deterministic output with fixed randomness", () => {
    const a = generateApiKey(deterministicRandom);
    const b = generateApiKey(deterministicRandom);
    expect(a.raw).toBe(b.raw);
    expect(a.hash).toBe(b.hash);
    expect(a.prefix).toBe(b.prefix);
  });

  it("returns hash as SHA-256 hex of the raw key", () => {
    const { raw, hash } = generateApiKey(deterministicRandom);
    const expected = createHash("sha256").update(raw).digest("hex");
    expect(hash).toBe(expected);
  });

  it("returns hash as 64-character hex string", () => {
    const { hash } = generateApiKey(deterministicRandom);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("returns prefix as first 8 characters of raw key", () => {
    const { raw, prefix } = generateApiKey(deterministicRandom);
    expect(prefix).toBe(raw.slice(0, 8));
  });

  it("generates different keys with default randomness", () => {
    const a = generateApiKey();
    const b = generateApiKey();
    expect(a.raw).not.toBe(b.raw);
    expect(a.hash).not.toBe(b.hash);
  });
});
