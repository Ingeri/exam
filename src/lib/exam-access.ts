import { createHash, timingSafeEqual } from "node:crypto";

export function hashExamKey(value: string): string {
  return createHash("sha256").update(value.trim(), "utf8").digest("hex");
}

export function matchesExamKey(value: string, storedHash: string): boolean {
  const expected = Buffer.from(storedHash, "hex");
  const actual = Buffer.from(hashExamKey(value), "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
