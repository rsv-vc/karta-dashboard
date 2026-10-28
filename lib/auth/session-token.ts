import { createHmac, timingSafeEqual } from "node:crypto";

// Pure sign/verify helpers for the session cookie. Kept free of next/headers so
// proxy.ts and the check scripts can use them too.

export const SESSION_COOKIE = "karta_session";
export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

export interface SessionPayload {
  userId: string;
  /** Epoch milliseconds. */
  issuedAt: number;
  /** Epoch milliseconds. */
  expiresAt: number;
}

const DEV_FALLBACK_SECRET = "karta-dev-only-secret-do-not-use-in-production";
let warnedAboutFallback = false;

/** SESSION_SECRET from the environment; a fixed fallback is allowed in development only. */
export function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  // Reject the .env.example placeholder as well as short secrets.
  if (secret && secret.length >= 32 && !secret.startsWith("replace-me")) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET must be set (32+ characters) in production");
  }
  if (!warnedAboutFallback) {
    console.warn("[auth] SESSION_SECRET missing or short; using the development fallback secret");
    warnedAboutFallback = true;
  }
  return DEV_FALLBACK_SECRET;
}

function sign(data: string, secret: string): string {
  return createHmac("sha256", secret).update(data).digest("base64url");
}

/** "<base64url payload>.<base64url HMAC-SHA256>" */
export function createSessionToken(userId: string, secret: string, now: number = Date.now()): string {
  const payload: SessionPayload = { userId, issuedAt: now, expiresAt: now + SESSION_TTL_SECONDS * 1000 };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${sign(encoded, secret)}`;
}

function isSessionPayload(value: unknown): value is SessionPayload {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.userId === "string" && typeof v.issuedAt === "number" && typeof v.expiresAt === "number";
}

/** The payload if the token is untampered and unexpired, otherwise null. Never throws. */
export function verifySessionToken(
  token: string | undefined,
  secret: string,
  now: number = Date.now(),
): SessionPayload | null {
  if (!token) return null;
  const [encoded, signature, ...rest] = token.split(".");
  if (!encoded || !signature || rest.length > 0) return null;

  const expected = Buffer.from(sign(encoded, secret));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;

  try {
    const payload: unknown = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    if (!isSessionPayload(payload) || payload.expiresAt <= now) return null;
    return payload;
  } catch {
    return null;
  }
}
