import { createHash, createHmac, timingSafeEqual } from "node:crypto";

function examKeySecret(): string | null {
  const secret = process.env.EXAM_KEY_SECRET ?? process.env.AUTH_JWT_SECRET;
  return secret && Buffer.byteLength(secret) >= 32 ? secret : null;
}

export function hasExamKeySecret(): boolean {
  return examKeySecret() !== null;
}

export function hashExamKey(value: string): string {
  const secret = examKeySecret();
  if (!secret) throw new Error("EXAM_KEY_SECRET or AUTH_JWT_SECRET must be configured with at least 32 bytes.");
  const digest = createHmac("sha256", secret).update(value.trim(), "utf8").digest("hex");
  return `hmac-sha256:${digest}`;
}

export function matchesExamKey(value: string, storedHash: string): boolean {
  const secret = examKeySecret();
  const usesHmac = storedHash.startsWith("hmac-sha256:");
  if (usesHmac && !secret) return false;
  const expectedValue = usesHmac ? storedHash.slice("hmac-sha256:".length) : storedHash;
  const actualValue = usesHmac
    ? createHmac("sha256", secret!).update(value.trim(), "utf8").digest("hex")
    : createHash("sha256").update(value.trim(), "utf8").digest("hex");
  const expected = Buffer.from(expectedValue, "hex");
  const actual = Buffer.from(actualValue, "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
