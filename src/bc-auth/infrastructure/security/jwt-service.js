import { createHmac, randomBytes } from "node:crypto";

const DEFAULT_DEV_SECRET = "dev-secret-change-me";
const IS_PROD = String(process.env.NODE_ENV || "").trim().toLowerCase() === "production";

function resolveJwtSecret() {
  const secret = String(process.env.AUTH_JWT_SECRET || "").trim();
  if (!IS_PROD) return secret || DEFAULT_DEV_SECRET;
  if (!secret) throw new Error("AUTH_JWT_SECRET requis en production");
  if (secret === DEFAULT_DEV_SECRET || secret.length < 32) {
    throw new Error("AUTH_JWT_SECRET trop faible pour la production");
  }
  return secret;
}

const SECRET = resolveJwtSecret();

function b64url(v) {
  return Buffer.from(v).toString("base64url");
}

function signData(data) {
  return createHmac("sha256", SECRET).update(data).digest("base64url");
}

export function signAccessToken(payload) {
  const body = { ...payload };
  const encoded = b64url(JSON.stringify(body));
  const nonce = randomBytes(16).toString("base64url");
  const sig = signData(`${encoded}.${nonce}`);
  return `${encoded}.${nonce}.${sig}`;
}

export function verifyAccessToken(token) {
  const raw = String(token || "");
  const parts = raw.split(".");
  if (parts.length !== 2 && parts.length !== 3) throw new Error("Token invalide");

  const [encoded, nonce, sig] = parts.length === 3 ? parts : [parts[0], "", parts[1]];
  if (!encoded || !sig) throw new Error("Token invalide");

  const expected = parts.length === 3 ? signData(`${encoded}.${nonce}`) : signData(encoded);
  if (expected !== sig) throw new Error("Signature token invalide");
  return JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
}

export function createOpaqueToken() {
  return randomBytes(32).toString("hex");
}
