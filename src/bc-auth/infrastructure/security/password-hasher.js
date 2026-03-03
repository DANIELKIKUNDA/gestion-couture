import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const SCRYPT_N = 16384;
const KEYLEN = 32;

export function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(String(password || ""), salt, KEYLEN, { N: SCRYPT_N }).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

export function verifyPassword(password, encoded) {
  const parts = String(encoded || "").split(":");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const salt = parts[1];
  const expected = Buffer.from(parts[2], "hex");
  const actual = scryptSync(String(password || ""), salt, KEYLEN, { N: SCRYPT_N });
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}
