import { createHmac, randomBytes } from "node:crypto";

const SECRET = process.env.AUTH_JWT_SECRET || "dev-secret-change-me";

function b64url(v) {
  return Buffer.from(v).toString("base64url");
}

function signData(data) {
  return createHmac("sha256", SECRET).update(data).digest("base64url");
}

export function signAccessToken(payload) {
  const body = { ...payload };
  const encoded = b64url(JSON.stringify(body));
  const sig = signData(encoded);
  return `${encoded}.${sig}`;
}

export function verifyAccessToken(token) {
  const raw = String(token || "");
  const [encoded, sig] = raw.split(".");
  if (!encoded || !sig) throw new Error("Token invalide");
  const expected = signData(encoded);
  if (expected !== sig) throw new Error("Signature token invalide");
  return JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
}

export function createOpaqueToken() {
  return randomBytes(32).toString("hex");
}
