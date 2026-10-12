/**
 * Removes anything that looks like a credential from text that may be shown or logged:
 * JWT-shaped tokens, the stack's `sb_publishable_` / `sb_secret_` keys, passwords inside connection
 * URLs, and any extra literal values the caller knows about. Used for tooling output, thrown
 * messages and database error descriptions (NFR1.8, NFR1.13).
 */
const JWT_SHAPE = /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g;
const STACK_KEY_SHAPE = /\bsb_(?:publishable|secret)_[A-Za-z0-9_-]{8,}/g;
const URL_PASSWORD = /\b([a-z][a-z0-9+.-]*:\/\/[^\s:/@]+):[^\s@/]+@/gi;
const PRIVATE_KEY_HEADER =
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z ]*PRIVATE KEY-----|$)/g;

export const REDACTED = "[redacted]";

export function redactSecrets(text: string, secrets: readonly (string | undefined)[] = []): string {
  let result = text
    .replace(PRIVATE_KEY_HEADER, REDACTED)
    .replace(JWT_SHAPE, REDACTED)
    .replace(STACK_KEY_SHAPE, REDACTED)
    .replace(URL_PASSWORD, `$1:${REDACTED}@`);
  for (const secret of secrets) {
    if (secret && secret.length >= 6) result = result.split(secret).join(REDACTED);
  }
  return result;
}
