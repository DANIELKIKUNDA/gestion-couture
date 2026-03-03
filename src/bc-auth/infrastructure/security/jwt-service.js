import { createHmac, randomBytes } from "node:crypto";

const SECRET = process.env.AUTH_JWT_SECRET || "dev-secret-change-me";
const ACCESS_TTL = Number(process.env.AUTH_JWT_TTL_SECONDS || 86400);

function b64url(v) {
  return Buffer.from(v).toString("base64url");
}

function signData(data) {
  return createHmac("sha256", SECRET).update(data).digest("base64url");
}

export function signAccessToken(payload, ttlSeconds = ACCESS_TTL) {
  const now = Math.floor(Date.now() / 1000);
  const body = { ...payload, iat: now, exp: now + Number(ttlSeconds || ACCESS_TTL) };
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
  const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && now > payload.exp) throw new Error("Token expire");
  return payload;
}

export function createOpaqueToken() {
  return randomBytes(32).toString("hex");
}
