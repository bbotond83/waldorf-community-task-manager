import { createHash, createHmac, randomBytes } from "node:crypto";

/**
 * Standard primitives only (NFR2.6): SHA-256 for invitation tokens, an HMAC with a key derived from the
 * session secret for the lockout's email key. Nothing here logs or returns a secret it was given.
 */

/** A 32-byte random token, shown once in an emailed link (BR2.10). */
export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

/** The lower-case hexadecimal SHA-256 of a token: the only form that reaches the database. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

const EMAIL_SHAPE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function isPlausibleEmail(email: string): boolean {
  return email.length <= 254 && EMAIL_SHAPE.test(email);
}

/**
 * A keyed hash of a value (an email address, an account id) for the lockout table and the event lines, so
 * neither can be reversed by guessing addresses. The key is derived from the session secret per purpose.
 */
export function keyedHash(value: string, secret: string, purpose: "email" | "account"): string {
  const key = createHmac("sha256", secret).update(`identity:${purpose}:v1`).digest();
  return createHmac("sha256", key).update(value, "utf8").digest("hex");
}
