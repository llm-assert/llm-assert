import { createHash, randomBytes } from "node:crypto";

const KEY_PREFIX = "lma_";

type RandomSource = (size: number) => Buffer;

export function generateApiKey(randomSource: RandomSource = randomBytes): {
  raw: string;
  hash: string;
  prefix: string;
} {
  const random = randomSource(32).toString("base64url");
  const raw = `${KEY_PREFIX}${random}`;
  const hash = createHash("sha256").update(raw).digest("hex");
  const prefix = raw.slice(0, 8);
  return { raw, hash, prefix };
}
