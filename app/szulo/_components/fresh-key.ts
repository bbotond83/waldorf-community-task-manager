/**
 * A new idempotency key for one attempt of a form. The database refuses a key that is used again with
 * different content (idempotency_key_reused), so a form whose content can change between two attempts, such
 * as a reason text or a chosen partner, sends a key made for that attempt. The key is made from random
 * bytes, which work on every address the application is opened from (`crypto.randomUUID` needs a secure
 * page, and the application may be opened over the local network).
 */
export function freshKey(prefix: string): string {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  const token = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${prefix}:${token}`;
}

/** The first part of a form's own default key (`swap:<id>:v3` gives `swap`), the readable prefix of a fresh one. */
export function keyPrefix(defaultKey: string): string {
  const prefix = defaultKey.split(":")[0] ?? "";
  return /^[A-Za-z0-9][A-Za-z0-9_-]{0,40}$/.test(prefix) ? prefix : "attempt";
}
